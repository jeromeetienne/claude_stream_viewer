# demo_vhs/demo.tape — regenerate with:  npm run demo_vhs:gif
# One deterministic hero GIF: raw stream-json -> piped through the viewer -> --stats.
Output claude_stream_viewer.gif

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 1000
Set Padding 24
Set Margin 24
Set BorderRadius 8
Set WindowBar Colorful
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms
Set PlaybackSpeed 1.0
Env FORCE_COLOR "1"

Hide
Type "export PATH=$PWD/.bin:$PATH" Enter
Type "S=../data/claude_events/vhs_tape.claude_events.jsonl" Enter
Type "PS1='$ '" Enter
Type "clear" Enter
Sleep 500ms
Show

# 1) raw stream-json — the "before": a wall of unreadable JSON
Type "# 1) raw stream-json, as claude --output-format stream-json emits it" Enter
Sleep 1s
Type "cat $S | head -4" Enter
Sleep 3500ms
Type "clear" Enter
Sleep 400ms

# 2) same stream through claude_stream_viewer — the "after"
Type "# 2) pipe the same stream through claude_stream_viewer" Enter
Sleep 1s
Type "cat $S | claude_stream_viewer" Enter
Sleep 5s
Type "clear" Enter
Sleep 400ms

# 3) --stats prints only the end-of-run summary
Type "# 3) add --stats for the end-of-run summary" Enter
Sleep 1s
Type "cat $S | claude_stream_viewer --stats" Enter
Sleep 6s
