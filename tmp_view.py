from pathlib import Path
text = Path('src/components/trading/TradeLayout.tsx').read_text(encoding='utf-8')
lines = text.splitlines()
for i,line in enumerate(lines[320:360], start=321):
    print(f"{i}: {line}")
