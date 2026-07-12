// App chrome + module titles + category names. EN values for module titles
// MUST match the manifest titles exactly (e2e + UI depend on them).
export const shell = {
  en: {
    // Module titles — keep identical to each module's manifest title.
    'mod.initiative.title': 'Initiative Tracker',
    'mod.timer.title': 'Session Timer',
    'mod.roller.title': 'Quick Roller',
    'mod.npcs.title': 'NPCs',
    'mod.lore.title': 'Lore Wiki',
    'mod.calendar.title': 'Calendar',
    'mod.reveal.title': 'Reveal',
    'mod.map.title': 'Battle Map',
    'mod.audio.title': 'Audio',
    'mod.handouts.title': 'Handouts',
    'mod.notebook.title': 'Session Notes',
    'mod.planner.title': 'Session Planner',
    'mod.sanity.title': 'Sanity',
    'mod.palette.title': 'Command Palette',
    'mod.rules.title': 'Rules Reference',
    'mod.stage.title': 'Broadcast Stage',
    'mod.preview.title': 'Broadcast Preview',

    // Categories — keep identical to categories.ts keys.
    'cat.Combat': 'Combat',
    'cat.NPCs & World': 'NPCs & World',
    'cat.Maps & Broadcast': 'Maps & Broadcast',
    'cat.Atmosphere': 'Atmosphere',
    'cat.Dice & Rules': 'Dice & Rules',
    'cat.Prep & Notes': 'Prep & Notes',
    'cat.Investigation': 'Investigation',
    'cat.Utility': 'Utility',
    'cat.Other': 'Other',

    // Topbar chrome.
    'topbar.openBroadcast': 'Open Broadcast',
    'topbar.layouts': 'Layouts',
    'topbar.tile': 'Tile',
    'topbar.closeAll': 'Close all',
    'topbar.save': 'Save',
    'topbar.saveAs': 'Save current as…',
    'topbar.noLayouts': 'No saved layouts',
    'topbar.layoutsHeader': 'layouts',
    'topbar.density': 'Toggle density',
    'topbar.sessionTitle': 'Session title',
    'topbar.densityCompact': 'Switch to compact',
    'topbar.densityComfortable': 'Switch to comfortable',

    // Global ON AIR lamp.
    'onair.live': 'On Air',
    'onair.off': 'Off Air',
    'onair.panic': 'Clear',
    'onair.panicTitle': 'Black-screen the broadcast and stop audio',

    // Dock chrome.
    'dock.widgets': 'Widgets',
    'dock.collapse': 'Hide widget bar',
    'dock.expand': 'Show widget bar',

    // Window frame chrome.
    'win.feedback': 'Feedback',
    'win.feedbackFor': 'Feedback · ',
    'win.feedbackPlaceholder': 'What to fix in this component…',
    'win.export': '⤓ Export',
    'win.save': 'Save',
    'win.delete': 'Delete',
    'win.collapse': 'Collapse',
    'win.expand': 'Expand',
    'win.close': 'Close',

    // Broadcast idle screen.
    'broadcast.idle': 'Awaiting the Keeper…',
    'broadcast.enableAudio': '🔊 Click to enable audio',

    // Language switcher.
    'lang.label': 'Language',

    // Editor host + sidebar + tab strip.
    'editorHost.noEditorPre': 'No editor for ',
    'editorHost.noEditorPost': ' yet.',
    'sidebar.desktop': 'Desktop',
    'sidebar.modules': 'Modules',
    'sidebar.onair': 'On air',
    'sidebar.quickroll': 'Quick roll',
    'sidebar.playersSee': 'What players see right now',
    'sidebar.tagline': 'Cthulhu Edition',
    'sidebar.campaign': 'Campaign',
    'sidebar.export': 'Export',
    'sidebar.import': 'Import',
    'sidebar.exported': 'Exported.',
    'sidebar.imported': 'Imported — reload to see changes.',
    'sidebar.importFailedPre': 'Import failed: ',

    // App-wide toast + palette verb hint.
    'toast.undo': 'Undo',
    'toast.dismiss': 'Dismiss',
    'toast.sceneDeleted': 'Scene deleted',
    'toast.handoutDeleted': 'Handout deleted',
    'toast.npcDeleted': 'NPC deleted',
    'toast.loreDeleted': 'Lore page deleted',
    'palette.verbRun': 'Press Enter to run this command',
  },
  pl: {
    // Module titles.
    'mod.initiative.title': 'Licznik inicjatywy',
    'mod.timer.title': 'Czas sesji',
    'mod.roller.title': 'Szybki rzut',
    'mod.npcs.title': 'BN-i',
    'mod.lore.title': 'Wiki świata',
    'mod.calendar.title': 'Kalendarz',
    'mod.reveal.title': 'Odsłona',
    'mod.map.title': 'Mapa bitwy',
    'mod.audio.title': 'Dźwięk',
    'mod.handouts.title': 'Materiały',
    'mod.notebook.title': 'Notatki z sesji',
    'mod.planner.title': 'Planer sesji',
    'mod.sanity.title': 'Poczytalność',
    'mod.palette.title': 'Paleta poleceń',
    'mod.rules.title': 'Odniesienie do zasad',
    'mod.stage.title': 'Scena transmisji',
    'mod.preview.title': 'Podgląd transmisji',

    // Categories.
    'cat.Combat': 'Walka',
    'cat.NPCs & World': 'BN-i i świat',
    'cat.Maps & Broadcast': 'Mapy i transmisja',
    'cat.Atmosphere': 'Atmosfera',
    'cat.Dice & Rules': 'Kości i zasady',
    'cat.Prep & Notes': 'Przygotowanie i notatki',
    'cat.Investigation': 'Śledztwo',
    'cat.Utility': 'Narzędzia',
    'cat.Other': 'Inne',

    // Topbar chrome.
    'topbar.openBroadcast': 'Otwórz transmisję',
    'topbar.layouts': 'Układy',
    'topbar.tile': 'Kafelki',
    'topbar.closeAll': 'Zamknij wszystkie',
    'topbar.save': 'Zapisz',
    'topbar.saveAs': 'Zapisz bieżący jako…',
    'topbar.noLayouts': 'Brak zapisanych układów',
    'topbar.layoutsHeader': 'układy',
    'topbar.sessionTitle': 'Tytuł sesji',
    'topbar.density': 'Przełącz gęstość',
    'topbar.densityCompact': 'Przełącz na zwartą',
    'topbar.densityComfortable': 'Przełącz na komfortową',

    // Global ON AIR lamp.
    'onair.live': 'Na antenie',
    'onair.off': 'Poza anteną',
    'onair.panic': 'Wyczyść',
    'onair.panicTitle': 'Wygaś transmisję i zatrzymaj dźwięk',

    // Dock chrome.
    'dock.widgets': 'Widżety',
    'dock.collapse': 'Ukryj pasek widżetów',
    'dock.expand': 'Pokaż pasek widżetów',

    // Window frame chrome.
    'win.feedback': 'Uwagi',
    'win.feedbackFor': 'Uwagi · ',
    'win.feedbackPlaceholder': 'Co poprawić w tym komponencie…',
    'win.export': '⤓ Eksport',
    'win.save': 'Zapisz',
    'win.delete': 'Usuń',
    'win.collapse': 'Zwiń',
    'win.expand': 'Rozwiń',
    'win.close': 'Zamknij',

    // Broadcast idle screen.
    'broadcast.idle': 'Oczekiwanie na Strażnika…',
    'broadcast.enableAudio': '🔊 Kliknij, aby włączyć dźwięk',

    // Language switcher.
    'lang.label': 'Język',

    // Editor host + sidebar + tab strip.
    'editorHost.noEditorPre': 'Brak edytora dla ',
    'editorHost.noEditorPost': ' (jeszcze).',
    'sidebar.desktop': 'Pulpit',
    'sidebar.modules': 'Moduły',
    'sidebar.onair': 'Transmisja',
    'sidebar.quickroll': 'Szybki rzut',
    'sidebar.playersSee': 'Co gracze teraz widzą',
    'sidebar.tagline': 'Edycja Cthulhu',
    'sidebar.campaign': 'Kampania',
    'sidebar.export': 'Eksport',
    'sidebar.import': 'Import',
    'sidebar.exported': 'Wyeksportowano.',
    'sidebar.imported': 'Zaimportowano — odśwież, aby zobaczyć zmiany.',
    'sidebar.importFailedPre': 'Import nieudany: ',

    // App-wide toast + palette verb hint.
    'toast.undo': 'Cofnij',
    'toast.dismiss': 'Odrzuć',
    'toast.sceneDeleted': 'Usunięto scenę',
    'toast.handoutDeleted': 'Usunięto materiał',
    'toast.npcDeleted': 'Usunięto BN',
    'toast.loreDeleted': 'Usunięto stronę wiedzy',
    'palette.verbRun': 'Naciśnij Enter, aby wykonać polecenie',
  },
};
