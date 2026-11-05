// ToadsPMS.cs — 선상(엣지) PMS 런처 (Docker 불필요, Windows 네이티브)
// .NET Framework 4.x (Windows 10/11 기본 탑재). 외부 의존성 없음.
// 빌드: %WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:exe /platform:x64 /optimize+ /out:ToadsPMS.exe ToadsPMS.cs
//
// 동작: 같은 폴더의 node.exe 로 app\server.js 를 실행한다.
//  - config.env(KEY=VALUE, UTF-8)를 읽어 자식 프로세스 환경변수로 전달(기본값 보충, config 우선).
//  - 필수값 검증, 로그 파일 기록(logs\pms-YYYYMMDD.log), Job Object 로 자식 동반 종료 보장.
//  - 토큰/비밀번호는 절대 출력하지 않는다.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace ToadsPmsEdge
{
    static class Program
    {
        const string VERSION = "ToadsPMS Edge Launcher 1.0";

        static readonly object logLock = new object();
        static string logDir;
        static string currentLogDate;
        static StreamWriter logWriter;
        static Process child;
        static IntPtr job = IntPtr.Zero;
        static ConsoleCtrlDelegate ctrlHandler;

        static int Main()
        {
            try { Console.OutputEncoding = Encoding.UTF8; } catch { }

            string baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
            string nodeExe = Path.Combine(baseDir, "node.exe");
            string appDir = Path.Combine(baseDir, "app");
            string serverJs = Path.Combine(appDir, "server.js");
            logDir = Path.Combine(baseDir, "logs");

            if (!File.Exists(nodeExe) || !File.Exists(serverJs))
            {
                Console.Error.WriteLine("[오류] node.exe 또는 app\\server.js 를 찾을 수 없습니다.");
                Console.Error.WriteLine("       패키지가 손상되었거나, 올바른 폴더에서 실행하지 않았습니다.");
                return 2;
            }

            try { Directory.CreateDirectory(logDir); } catch { }

            Dictionary<string, string> cfg = ReadConfig(Path.Combine(baseDir, "config.env"));

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = nodeExe;
            psi.Arguments = "server.js";
            psi.WorkingDirectory = appDir;
            psi.UseShellExecute = false;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.StandardOutputEncoding = Encoding.UTF8;
            psi.StandardErrorEncoding = Encoding.UTF8;

            // 기본값: 현재 환경에 없을 때만 보충
            var defaults = new Dictionary<string, string>
            {
                { "NODE_ENV", "production" }, { "HOSTNAME", "0.0.0.0" }, { "PORT", "30001" },
                { "NODE_ROLE", "edge" }, { "SYNC_WATCHER", "on" },
                { "DB_HOST", "127.0.0.1" }, { "DB_PORT", "5432" }, { "DB_SSL", "false" }
            };
            foreach (var kv in defaults)
                if (!psi.EnvironmentVariables.ContainsKey(kv.Key))
                    psi.EnvironmentVariables[kv.Key] = kv.Value;

            // config 값이 최우선(현재 환경/기본값을 덮어씀)
            foreach (var kv in cfg)
                psi.EnvironmentVariables[kv.Key] = kv.Value;

            // SYNC_INTERVAL_MIN 만 있고 _MS 가 없으면 분*60000 계산
            string minStr = Get(psi, "SYNC_INTERVAL_MIN");
            string msStr = Get(psi, "SYNC_INTERVAL_MS");
            if (!string.IsNullOrEmpty(minStr) && string.IsNullOrEmpty(msStr))
            {
                long mins;
                if (long.TryParse(minStr.Trim(), out mins) && mins > 0)
                    psi.EnvironmentVariables["SYNC_INTERVAL_MS"] = (mins * 60000L).ToString();
            }

            // 필수값 검증 (없음 / 빈 값 / "여기에…" 예시 그대로 → 오류)
            string[] required = { "VESSEL", "REMOTE_SITE_URL", "NODE_TOKEN", "DB_NAME", "DB_USER", "DB_PASS" };
            var bad = new List<string>();
            foreach (var k in required)
            {
                string v = Get(psi, k);
                if (string.IsNullOrEmpty(v) || v.StartsWith("여기에")) bad.Add(k);
            }
            if (bad.Count > 0)
            {
                Console.Error.WriteLine("[오류] config.env 의 다음 필수 설정값이 비어 있거나 예시 그대로입니다:");
                Console.Error.WriteLine("       " + string.Join(", ", bad.ToArray()));
                Console.Error.WriteLine("       config.env 를 메모장으로 열어 값을 채운 뒤 다시 실행하세요.");
                MaybeWait();
                return 2;
            }

            try { SetupJob(); } catch { }

            Log(VERSION);
            Log("선박코드 : " + Get(psi, "VESSEL"));
            Log("중앙서버 : " + Get(psi, "REMOTE_SITE_URL"));
            Log("포트     : " + Get(psi, "PORT"));
            Log("DB       : " + Get(psi, "DB_NAME") + "@" + Get(psi, "DB_HOST") + ":" + Get(psi, "DB_PORT"));
            Log("앱 서버를 시작합니다 ...");

            child = new Process();
            child.StartInfo = psi;
            child.OutputDataReceived += delegate(object s, DataReceivedEventArgs e) { if (e.Data != null) Log(e.Data); };
            child.ErrorDataReceived += delegate(object s, DataReceivedEventArgs e) { if (e.Data != null) Log(e.Data); };

            Console.CancelKeyPress += delegate(object s, ConsoleCancelEventArgs e) { e.Cancel = true; KillChild(); };
            ctrlHandler = new ConsoleCtrlDelegate(OnConsoleCtrl);
            try { SetConsoleCtrlHandler(ctrlHandler, true); } catch { }

            DateTime startedAt = DateTime.UtcNow;
            try
            {
                child.Start();
            }
            catch (Exception ex)
            {
                Log("[오류] 앱 서버 실행 실패: " + ex.Message);
                MaybeWait();
                return 2;
            }

            try { if (job != IntPtr.Zero) AssignProcessToJobObject(job, child.Handle); } catch { }

            child.BeginOutputReadLine();
            child.BeginErrorReadLine();
            child.WaitForExit();

            int code = child.ExitCode;
            double secs = (DateTime.UtcNow - startedAt).TotalSeconds;
            Log("앱 서버가 종료되었습니다. (exit code " + code + ")");
            if (secs < 10.0)
            {
                Log("[주의] 서버가 시작 직후 종료되었습니다. 아래 로그를 확인하세요:");
                Log("       " + Path.Combine(logDir, "pms-" + DateTime.Now.ToString("yyyyMMdd") + ".log"));
                MaybeWait();
            }
            return code;
        }

        static string Get(ProcessStartInfo psi, string key)
        {
            return psi.EnvironmentVariables.ContainsKey(key) ? psi.EnvironmentVariables[key] : null;
        }

        static Dictionary<string, string> ReadConfig(string path)
        {
            var d = new Dictionary<string, string>();
            if (!File.Exists(path)) return d;
            foreach (string raw in File.ReadAllLines(path, Encoding.UTF8))
            {
                string trimmed = raw.Trim();
                if (trimmed.Length == 0 || trimmed[0] == '#') continue;
                int idx = raw.IndexOf('=');
                if (idx <= 0) continue;
                string key = raw.Substring(0, idx).Trim();
                string val = raw.Substring(idx + 1).Trim().TrimEnd('\r');
                if (key.Length == 0) continue;
                d[key] = val;
            }
            return d;
        }

        static void Log(string msg)
        {
            string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + msg;
            lock (logLock)
            {
                try { Console.Out.WriteLine(line); } catch { }
                try
                {
                    string today = DateTime.Now.ToString("yyyyMMdd");
                    if (logWriter == null || today != currentLogDate)
                    {
                        if (logWriter != null) { try { logWriter.Dispose(); } catch { } }
                        currentLogDate = today;
                        FileStream fs = new FileStream(
                            Path.Combine(logDir, "pms-" + today + ".log"),
                            FileMode.Append, FileAccess.Write, FileShare.Read | FileShare.Delete);
                        logWriter = new StreamWriter(fs, new UTF8Encoding(false));
                        logWriter.AutoFlush = true;
                    }
                    logWriter.WriteLine(line);
                }
                catch { }
            }
        }

        static void KillChild()
        {
            try { if (child != null && !child.HasExited) child.Kill(); } catch { }
        }

        static void MaybeWait()
        {
            try
            {
                // 서비스(nssm, 세션 0)로 실행 중이면 키 입력을 기다리지 않는다.
                // 기다리면 프로세스가 끝나지 않아 nssm 의 자동 재시작이 동작하지 않는다.
                if (Environment.UserInteractive && GetConsoleWindow() != IntPtr.Zero && !Console.IsInputRedirected)
                {
                    Console.Error.WriteLine("아무 키나 누르면 창이 닫힙니다 ...");
                    Console.ReadKey(true);
                }
            }
            catch { }
        }

        static bool OnConsoleCtrl(uint ctrlType)
        {
            // CTRL_C(0)/BREAK(1)/CLOSE(2)/LOGOFF(5)/SHUTDOWN(6): 자식 종료 후 기본 처리 진행
            KillChild();
            return false;
        }

        static void SetupJob()
        {
            job = CreateJobObject(IntPtr.Zero, null);
            if (job == IntPtr.Zero) return;
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            int len = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
            IntPtr p = Marshal.AllocHGlobal(len);
            try
            {
                Marshal.StructureToPtr(info, p, false);
                SetInformationJobObject(job, JobObjectExtendedLimitInformation, p, (uint)len);
            }
            finally { Marshal.FreeHGlobal(p); }
        }

        // ---- P/Invoke ----
        const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
        const int JobObjectExtendedLimitInformation = 9;

        delegate bool ConsoleCtrlDelegate(uint ctrlType);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

        [DllImport("kernel32.dll")]
        static extern bool SetInformationJobObject(IntPtr hJob, int infoClass, IntPtr lpInfo, uint cbInfoLength);

        [DllImport("kernel32.dll")]
        static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

        [DllImport("kernel32.dll")]
        static extern bool SetConsoleCtrlHandler(ConsoleCtrlDelegate handler, bool add);

        [DllImport("kernel32.dll")]
        static extern IntPtr GetConsoleWindow();

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_BASIC_LIMIT_INFORMATION
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct IO_COUNTERS
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
        {
            public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
            public IO_COUNTERS IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }
    }
}
