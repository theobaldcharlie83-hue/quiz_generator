Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set objShell = CreateObject("WScript.Shell")
' Launch run.bat in hidden mode (0) and do not wait for it to finish (False)
' The batch script itself handles the waiting and cleanup.
objShell.Run Chr(34) & scriptDir & "\run.bat" & Chr(34), 0, False
