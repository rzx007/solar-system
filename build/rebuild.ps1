# 将各部分逻辑装配为单文件 solar.html
# 关键：全部使用显式 UTF-8 I/O。PowerShell 5.1 的 Get-Content -Raw 对无 BOM 文件
# 会按系统 ANSI(GBK) 解码，导致中文乱码并破坏标签，故这里统一用 .NET API。
$ErrorActionPreference = 'Stop'

$root  = Split-Path -Parent $PSScriptRoot
$parts = @('logic_a.js','logic_b1.js','logic_b2.js','logic_b3.js','logic_c1.js','logic_c2.js','logic_d.js')

function Read-Utf8([string]$path){
  if(-not (Test-Path -LiteralPath $path)){ throw "missing: $path" }
  # 先按 BOM 检测解码，再回退到无 BOM 的 UTF-8
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
  if($hasBom){
    return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
  }
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append((Read-Utf8 (Join-Path $PSScriptRoot 'head.html')))
foreach($f in $parts){
  [void]$sb.Append((Read-Utf8 (Join-Path $root $f)))
  [void]$sb.Append("`r`n")
}
[void]$sb.Append("</script>`r`n</body>`r`n</html>`r`n")

$out = Join-Path $root 'solar.html'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($out, $sb.ToString(), $utf8NoBom)
Write-Output ("built solar.html bytes=" + (Get-Item $out).Length)
