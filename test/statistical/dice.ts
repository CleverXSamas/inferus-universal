import assert from 'node:assert/strict';
import { roll } from '../../packages/dice-core/index.ts';
// Each die is tested with 1,000,000 independent draws. A 7-sigma threshold
// bounds the false-positive probability while detecting meaningful bias.
const samples = 1_000_000;
for (const sides of [6, 20]) {
  const counts = Array<number>(sides).fill(0),
    expression = `40d${sides}`;
  for (let i = 0; i < samples / 40; i++)
    for (const die of roll(expression).groups[0].dice) counts[die.total - 1]++;
  const expected = samples / sides,
    sigma = Math.sqrt(samples * (1 / sides) * (1 - 1 / sides));
  for (const n of counts)
    assert.ok(Math.abs(n - expected) < 7 * sigma, `Distribuição d${sides} fora de 7σ: ${counts}`);
  console.log(`d${sides}: ${samples} amostras, frequências ${counts.join(', ')}`);
}
