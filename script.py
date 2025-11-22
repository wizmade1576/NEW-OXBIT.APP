from pathlib import Path
path=Path('src/pages/positions/WhalesPage.tsx')
text=path.read_text(encoding='utf-8')
old='const [thresholdKrw, setThresholdKrw] = React.useState<number>(100_000_000) // 1??기본'
if old not in text:
    raise SystemExit('old text not found')
new='const [thresholdKrw, setThresholdKrw] = React.useState<number>(100_000_000) // 1억 기준'
path.write_text(text.replace(old,new,1), encoding='utf-8')
