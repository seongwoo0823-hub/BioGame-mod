// 바이오 비트 앨범 커버 43장 만들기: cover.html을 곡마다 열어 600×600으로 찍고 480×480 JPG로 저장
//   준비: 이 폴더에 fonts → @fontsource 폴더 링크 (npm i @fontsource/black-han-sans … 후 ln -s node_modules/@fontsource fonts)
//   node render.js [시작번호] [끝번호]
const {chromium} = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '../../../games/bio-beat/art/cover');
const SONGS = eval(fs.readFileSync(path.join(__dirname, 'songs.js'), 'utf8').replace('const SONGS=', '(') .replace(/;\s*$/, ')'));
(async () => {
  fs.mkdirSync(OUT, {recursive: true});
  const a = +(process.argv[2] || 0), b = +(process.argv[3] || SONGS.length - 1);
  const br = await chromium.launch();
  const pg = await br.newPage({viewport: {width: 600, height: 600}, deviceScaleFactor: 1});
  for (let i = a; i <= b; i++) {
    await pg.goto('file://' + path.join(__dirname, 'cover.html') + '?i=' + i);
    await pg.waitForFunction(() => document.title === 'done', null, {timeout: 15000});
    const buf = await pg.screenshot({type: 'png', clip: {x: 0, y: 0, width: 600, height: 600}});
    fs.writeFileSync(path.join(__dirname, '.tmp.png'), buf);
    require('child_process').execFileSync('python3', ['-c',
      `from PIL import Image;Image.open('${path.join(__dirname, '.tmp.png')}').convert('RGB').resize((480,480),Image.LANCZOS).save('${path.join(OUT, SONGS[i].id + '.jpg')}',quality=88)`]);
    process.stdout.write(SONGS[i].id + ' ');
  }
  fs.unlinkSync(path.join(__dirname, '.tmp.png'));
  await br.close(); console.log('\ndone');
})();
