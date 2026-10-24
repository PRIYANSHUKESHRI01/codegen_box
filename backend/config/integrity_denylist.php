<?php

/*
|--------------------------------------------------------------------------
| What the AptRun Guardian looks for on the student's computer
|--------------------------------------------------------------------------
|
| The server hands this to the Guardian when it pairs and whenever `version` changes, so the list can be tightened
| WITHOUT shipping a new installer. Matching is done on the student's machine, in lower case:
|
|   processes  the executable's name, without ".exe", must EQUAL the pattern. Exact on purpose: "obs" must never
|              match "observer". List real variants (obs64, obs32) instead of using prefixes.
|   strings    the file's own metadata (ProductName / OriginalFilename / FileDescription) must CONTAIN the pattern. This
|              is what catches a renamed executable: anydesk.exe copied to calc.exe still says "AnyDesk" inside.
|   titles     the title of ANY visible window must CONTAIN the pattern (a "ChatGPT" tab in a second browser window).
|
| Each entry is [pattern, category, strike|null]. The category is a key of integrity.guardian.categories (what it is
| called and what it costs); a non-null third value overrides that category's strike for this entry (a title is weaker
| evidence than a running program, so title matches cost one strike, not the attempt).
|
| Anything running when the student presses "Start" is a PRE-FLIGHT blocker — they are told to close it and nothing is
| held against them. Only programs that appear AFTER the attempt began cost a strike.
|
*/

return [

    'version' => '2026.11.1',

    'processes' => [
        // Remote control — somebody else operating, or watching, the machine.
        ['anydesk', 'remote_control'], ['teamviewer', 'remote_control'], ['teamviewer_service', 'remote_control'],
        ['tv_w32', 'remote_control'], ['tv_x64', 'remote_control'], ['rustdesk', 'remote_control'],
        ['ultraviewer', 'remote_control'], ['ultraviewer_desktop', 'remote_control'], ['parsecd', 'remote_control'],
        ['parsec', 'remote_control'], ['splashtop', 'remote_control'], ['strwinclt', 'remote_control'],
        ['logmein', 'remote_control'], ['lmiguardiansvc', 'remote_control'], ['screenconnect.clientservice', 'remote_control'],
        ['screenconnect.windowsclient', 'remote_control'], ['vncviewer', 'remote_control'], ['winvnc', 'remote_control'],
        ['tvnserver', 'remote_control'], ['tightvnc', 'remote_control'], ['remoting_host', 'remote_control'],
        ['chromoting', 'remote_control'], ['quickassist', 'remote_control'], ['msra', 'remote_control'],
        ['mstsc', 'remote_control'], ['dwagent', 'remote_control'], ['dwservice', 'remote_control'],
        ['supremo', 'remote_control'], ['aeroadmin', 'remote_control'], ['ammyy', 'remote_control'],
        ['zohoassist', 'remote_control'], ['todesk', 'remote_control'], ['sunloginclient', 'remote_control'],
        ['radmin', 'remote_control'], ['rutserv', 'remote_control'], ['rfusclient', 'remote_control'],
        ['meshagent', 'remote_control'], ['nxserver', 'remote_control'], ['nxplayer', 'remote_control'],
        ['gotomypc', 'remote_control'], ['anyviewer', 'remote_control'], ['aweray', 'remote_control'],

        // AI assistants and interview "copilots".
        ['chatgpt', 'ai_assistant'], ['claude', 'ai_assistant'], ['cluely', 'ai_assistant'], ['ollama', 'ai_assistant'],
        ['ollama app', 'ai_assistant'], ['lm studio', 'ai_assistant'], ['lmstudio', 'ai_assistant'],
        ['perplexity', 'ai_assistant'], ['deepseek', 'ai_assistant'], ['interviewcoder', 'ai_assistant'],
        ['leetcodewizard', 'ai_assistant'], ['finalround', 'ai_assistant'], ['parakeet', 'ai_assistant'],
        ['lockedin', 'ai_assistant'], ['jan', 'ai_assistant'], ['gpt4all', 'ai_assistant'], ['msty', 'ai_assistant'],

        // Screen sharing / recording / meetings.
        ['obs', 'screen_sharing'], ['obs64', 'screen_sharing'], ['obs32', 'screen_sharing'], ['streamlabs obs', 'screen_sharing'],
        ['streamlabs desktop', 'screen_sharing'], ['xsplit.core', 'screen_sharing'], ['bandicam', 'screen_sharing'],
        ['camtasia', 'screen_sharing'], ['camtasiastudio', 'screen_sharing'], ['snagit32', 'screen_sharing'],
        ['snagiteditor', 'screen_sharing'], ['sharex', 'screen_sharing'], ['screenrec', 'screen_sharing'],
        ['loom', 'screen_sharing'], ['zoom', 'screen_sharing'], ['cpthost', 'screen_sharing'], ['ms-teams', 'screen_sharing'],
        ['teams', 'screen_sharing'], ['skype', 'screen_sharing'], ['webexmta', 'screen_sharing'], ['webex', 'screen_sharing'],
        ['gotomeeting', 'screen_sharing'], ['g2mcomm', 'screen_sharing'], ['nvidia share', 'screen_sharing'],
        ['gamebar', 'screen_sharing'], ['gamebarftserver', 'screen_sharing'], ['screentogif', 'screen_sharing'],

        // Messaging — an answer arriving from somebody else.
        ['whatsapp', 'messaging'], ['telegram', 'messaging'], ['signal', 'messaging'], ['wechat', 'messaging'],
        ['discord', 'messaging'], ['slack', 'messaging'], ['line', 'messaging'], ['viber', 'messaging'],

        // Intercepting or rewriting the connection.
        ['fiddler', 'network_tool'], ['fiddler everywhere', 'network_tool'], ['charles', 'network_tool'],
        ['mitmproxy', 'network_tool'], ['mitmdump', 'network_tool'], ['mitmweb', 'network_tool'],
        ['burpsuite', 'network_tool'], ['burpsuite_community', 'network_tool'], ['wireshark', 'network_tool'],
        ['dumpcap', 'network_tool'], ['tshark', 'network_tool'], ['proxifier', 'network_tool'], ['httptoolkit', 'network_tool'],
        ['ngrok', 'network_tool'], ['cloudflared', 'network_tool'], ['zerotier-one', 'network_tool'],
        ['tailscaled', 'network_tool'], ['tailscale-ipn', 'network_tool'], ['openvpn', 'network_tool'],
        ['openvpn-gui', 'network_tool'], ['wireguard', 'network_tool'], ['nordvpn', 'network_tool'],
        ['expressvpn', 'network_tool'], ['protonvpn', 'network_tool'], ['surfshark', 'network_tool'],
        ['windscribe', 'network_tool'], ['psiphon3', 'network_tool'], ['ultrasurf', 'network_tool'],
        ['lantern', 'network_tool'], ['hotspotshield', 'network_tool'], ['cyberghost', 'network_tool'],
        ['privateinternetaccess', 'network_tool'], ['v2rayn', 'network_tool'], ['clash', 'network_tool'],
        ['shadowsocks', 'network_tool'], ['sstap', 'network_tool'],

        // Debuggers, injectors, memory tools.
        ['x64dbg', 'debugger'], ['x32dbg', 'debugger'], ['ollydbg', 'debugger'], ['windbg', 'debugger'],
        ['windbgx', 'debugger'], ['ida', 'debugger'], ['ida64', 'debugger'], ['cheatengine-x86_64', 'debugger'],
        ['cheatengine-x86_64-sse4-avx2', 'debugger'], ['cheat engine', 'debugger'], ['processhacker', 'debugger'],
        ['systeminformer', 'debugger'], ['procmon', 'debugger'], ['procmon64', 'debugger'], ['procexp', 'debugger'],
        ['procexp64', 'debugger'], ['dnspy', 'debugger'], ['httpdebuggerui', 'debugger'], ['apimonitor-x64', 'debugger'],
        ['frida-server', 'debugger'], ['extremeinjector', 'debugger'], ['scylla', 'debugger'],

        // Input automation — typing or clicking for the student.
        ['autohotkey', 'automation'], ['autohotkey32', 'automation'], ['autohotkey64', 'automation'],
        ['autohotkeyu32', 'automation'], ['autohotkeyu64', 'automation'], ['autoit3', 'automation'],
        ['tinytask', 'automation'], ['macrorecorder', 'automation'], ['jitbit macro recorder', 'automation'],
        ['pulover', 'automation'], ['ghostmouse', 'automation'], ['mouse recorder', 'automation'],
        ['keyboard-autotyper', 'automation'], ['autotyper', 'automation'],

        // Virtual machines, sandboxes, phone emulators.
        ['vmware', 'virtual_machine'], ['vmware-vmx', 'virtual_machine'], ['vmplayer', 'virtual_machine'],
        ['virtualbox', 'virtual_machine'], ['virtualboxvm', 'virtual_machine'], ['vboxsvc', 'virtual_machine'],
        ['vboxheadless', 'virtual_machine'], ['qemu-system-x86_64', 'virtual_machine'], ['vmconnect', 'virtual_machine'],
        ['prl_client_app', 'virtual_machine'], ['windowssandbox', 'virtual_machine'], ['windowssandboxclient', 'virtual_machine'],
        ['sandboxie', 'virtual_machine'],
        ['bluestacks', 'virtual_machine'], ['hd-player', 'virtual_machine'], ['nox', 'virtual_machine'],
        ['noxvmhandle', 'virtual_machine'], ['ldplayer', 'virtual_machine'], ['dnplayer', 'virtual_machine'],
        ['memu', 'virtual_machine'], ['genymotion', 'virtual_machine'],
    ],

    // Metadata inside the executable — survives renaming the file.
    'strings' => [
        ['anydesk', 'remote_control'], ['teamviewer', 'remote_control'], ['rustdesk', 'remote_control'],
        ['ultraviewer', 'remote_control'], ['splashtop', 'remote_control'], ['screenconnect', 'remote_control'],
        ['cluely', 'ai_assistant'], ['interview coder', 'ai_assistant'], ['chatgpt', 'ai_assistant'],
        ['obs studio', 'screen_sharing'], ['xsplit', 'screen_sharing'], ['mitmproxy', 'network_tool'],
        ['fiddler', 'network_tool'], ['wireshark', 'network_tool'], ['autohotkey', 'automation'],
        ['x64dbg', 'debugger'], ['cheat engine', 'debugger'], ['process hacker', 'debugger'],
        ['virtualbox', 'virtual_machine'], ['vmware', 'virtual_machine'],
    ],

    // Any visible window. One strike (the page might simply be open in a second browser window), not the attempt.
    'titles' => [
        ['chatgpt', 'ai_assistant', 1], ['claude.ai', 'ai_assistant', 1], ['- claude', 'ai_assistant', 1],
        ['gemini', 'ai_assistant', 1], ['copilot', 'ai_assistant', 1], ['perplexity', 'ai_assistant', 1],
        ['deepseek', 'ai_assistant', 1], ['grok', 'ai_assistant', 1], ['blackbox ai', 'ai_assistant', 1],
        ['phind', 'ai_assistant', 1], ['chegg', 'ai_assistant', 1], ['course hero', 'ai_assistant', 1],
        ['stack overflow', 'ai_assistant', 1], ['geeksforgeeks', 'ai_assistant', 1], ['leetcode', 'ai_assistant', 1],
        ['codeforces', 'ai_assistant', 1], ['hackerrank', 'ai_assistant', 1], ['w3schools', 'ai_assistant', 1],
        ['google translate', 'ai_assistant', 1], ['quillbot', 'ai_assistant', 1],
    ],

    // Click-through overlays from these (system) processes are normal and are never reported.
    'overlay_allowed' => [
        'dwm', 'explorer', 'shellexperiencehost', 'searchhost', 'searchapp', 'textinputhost', 'startmenuexperiencehost',
        'applicationframehost', 'sihost', 'ctfmon', 'lockapp', 'systemsettings', 'widgets', 'nvidia overlay',
        'nvcontainer', 'radeonsoftware',
    ],

    // Executables that count as "the browser the exam is in".
    'browsers' => ['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi', 'arc', 'chromium', 'yandex', 'duckduckgo'],
];
