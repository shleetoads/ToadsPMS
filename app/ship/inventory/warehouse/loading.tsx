export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-4">
            <div className="h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
        <main className="flex-1 min-w-0 p-6">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="h-8 bg-gray-200 rounded animate-pulse w-32 mb-2"></div>
                <div className="h-4 bg-gray-100 rounded animate-pulse w-64"></div>
              </div>
              <div className="h-10 bg-gray-200 rounded animate-pulse w-24"></div>
            </div>
            <div className="bg-white rounded-lg border">
              <div className="p-6">
                <div className="h-6 bg-gray-200 rounded animate-pulse w-24 mb-4"></div>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
