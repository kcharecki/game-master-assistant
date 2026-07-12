' Runs the GM Assistant launcher with no visible console window.
' 0 = hidden window, False = don't wait for it to exit.
CreateObject("Wscript.Shell").Run "cmd /c ""H:\repo\game-master-assistant\scripts\gm-autostart.cmd""", 0, False
