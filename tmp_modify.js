const fs = require('fs');
const fs = require('fs');
const path = 'src/pages/paper/PaperTrade.tsx';
let text = fs.readFileSync(path, 'utf8');
const start = text.indexOf('  const handleClosePosition = async () =
