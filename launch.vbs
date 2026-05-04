Set oShell = CreateObject("WScript.Shell")
Set oFSO = CreateObject("Scripting.FileSystemObject")
strDir = oFSO.GetParentFolderName(WScript.ScriptFullName)
oShell.Run "cmd /c """ & strDir & "\run.bat""", 0, True
