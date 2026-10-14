#!/bin/bash
# Запасной таймер внешнего сторожа: GitHub не запускает watchdog по расписанию,
# поэтому Мак раз в 10 минут запускает его вручную (проверка идёт с серверов GitHub).
# launchd: com.aquatoring.watchdog-kick
export PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
LOG="$HOME/.aquatoring/logs/watchdog-kick.log"
if gh workflow run watchdog.yml -R reporter40/gelendzhik-guesthouse-automation --ref main >/dev/null 2>>"$LOG"; then
  echo "$(date -u +%FT%TZ) kicked" >> "$LOG"
else
  echo "$(date -u +%FT%TZ) FAIL" >> "$LOG"
fi
tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
