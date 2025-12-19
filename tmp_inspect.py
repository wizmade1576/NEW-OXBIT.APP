from pathlib import Path\nlines = Path('src/pages/paper/PaperTrade.tsx').read_text(encoding='utf-8').splitlines()\nfor i in range(90, 125):\n    print(f'{i+1}: {lines[i]}')\n
