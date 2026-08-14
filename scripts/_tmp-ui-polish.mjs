import { readFileSync, writeFileSync } from 'node:fs';

function replace(path, oldText, newText) {
  const text = readFileSync(path, 'utf8');
  if (!text.includes(oldText)) throw new Error(`${path}: expected text not found`);
  writeFileSync(path, text.replace(oldText, newText));
}

replace(
  'src/styles.css',
  `@media (min-width: 1181px) and (max-height: 820px) {
  .scale-rail {
    top: 110px;
    transform: none;
  }

  .layer-card {
    bottom: 88px;
  }
}`,
  `@media (min-width: 1181px) and (max-height: 820px) {
  .hero-copy {
    margin-top: 44px;
  }

  .hero-copy h1 {
    margin: 10px 0 16px;
    font-size: clamp(3.25rem, 5.8vw, 5.9rem);
  }

  .lede {
    max-width: 590px;
    font-size: 0.96rem;
    line-height: 1.48;
  }

  .scale-rail {
    top: 110px;
    transform: none;
  }

  .layer-card {
    bottom: 88px;
  }
}`,
);

const homePath = 'src/HomeActionDeck.css';
const home = readFileSync(homePath, 'utf8');
const homeMarker = '@media (max-width: 980px) {';
if (!home.includes(homeMarker)) throw new Error('HomeActionDeck responsive marker missing');
const compact = `@media (min-width: 1181px) and (max-height: 820px) {
  .home-action-deck {
    margin-top: 18px;
  }

  .home-action-card {
    min-height: 154px;
    padding: 12px 14px;
  }

  .home-action-card p {
    margin: 7px 0 9px;
    font-size: 0.66rem;
    line-height: 1.38;
  }

  .home-action-footer {
    padding-top: 8px;
  }

  .home-action-card small {
    margin-top: 5px;
  }
}

`;
writeFileSync(homePath, home.replace(homeMarker, compact + homeMarker));

replace(
  'src/http-comparison.css',
  '.http-stage-meta{gap:14px;overflow-x:auto}.http-stage-meta>div{min-width:max-content}',
  '.http-stage-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 14px;overflow:visible}.http-stage-meta>div{min-width:0}.http-stage-meta>div:first-child{grid-column:1/-1}',
);
