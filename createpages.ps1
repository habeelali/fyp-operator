# Define the base directory
$baseDir = "src/app"

# Create folders and files with the specified code
$pages = @(
    @{
        Folder = "navigation"
        Code   = @'
import Sidebar from '@/components/Sidebar';
export default function NavigationPage() {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold text-white">Navigation & Map</h1>
        <p className="text-gray-400 mt-2">Map viewer will be implemented here.</p>
      </main>
    </div>
  );
}
'@
    },
    @{
        Folder = "telemetry"
        Code   = @'
import Sidebar from '@/components/Sidebar';
export default function TelemetryPage() {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold text-white">Live Telemetry</h1>
        <p className="text-gray-400 mt-2">Real-time sensor graphs will be implemented here.</p>
      </main>
    </div>
  );
}
'@
    },
    @{
        Folder = "network"
        Code   = @'
import Sidebar from '@/components/Sidebar';
export default function NetworkPage() {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold text-white">Network Diagnostics</h1>
        <p className="text-gray-400 mt-2">Connection management tools will be implemented here.</p>
      </main>
    </div>
  );
}
'@
    },
    @{
        Folder = "settings"
        Code   = @'
import Sidebar from '@/components/Sidebar';
export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-2">Configuration options will be implemented here.</p>
      </main>
    </div>
  );
}
'@
    }
)

# Create each folder and file
foreach ($page in $pages) {
    $folderPath = Join-Path -Path $baseDir -ChildPath $page.Folder
    $filePath = Join-Path -Path $folderPath -ChildPath "page.tsx"

    # Create folder if it doesn't exist
    if (!(Test-Path -Path $folderPath)) {
        New-Item -ItemType Directory -Path $folderPath | Out-Null
    }

    # Create file and write code
    $page.Code | Out-File -FilePath $filePath -Encoding utf8
    Write-Host "Created: $filePath"
}

Write-Host "All folders and files created successfully!"
