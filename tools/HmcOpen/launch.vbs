' hmcopen:// launcher - runs open.ps1 with no console window flash. ASCII only on purpose.
Option Explicit
Dim sh, fso, dir, url, re, cmd, rc
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
If WScript.Arguments.Count < 1 Then WScript.Quit 2
url = WScript.Arguments(0)
' Only the exact shapes the dashboard produces are passed on (nothing else reaches the shell line).
Set re = New RegExp
re.Pattern = "^hmcopen:/*(ping|[fd]/[A-Za-z0-9_-]+)/?$"
re.IgnoreCase = True
If Not re.Test(url) Then WScript.Quit 2
cmd = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & dir & "\open.ps1"" """ & url & """"
rc = sh.Run(cmd, 0, True)
WScript.Quit rc
