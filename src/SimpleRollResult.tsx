import type { ReactNode, CSSProperties } from 'react';
import type { RollRecord } from '../packages/dice-core';
import { describeDice } from '../packages/discord-ui';
import { Icon } from './editor-shared';
import { useRollAnimation } from './dice-feedback';
export function SimpleRollResult({
  result,
  animate = true,
  empty,
}: {
  result: RollRecord | null;
  animate?: boolean;
  empty?: ReactNode;
}) {
  const moving = useRollAnimation(result?.roll_id, animate);
  return (
    <div
      className={`simple-roll-result ${moving ? 'is-roll-animating' : ''}`}
      data-testid="simple-roll-result"
    >
      <div className="result-caption">
        <span className="eyebrow">A SORTE ESTÁ LANÇADA</span>
        <span className="roll-motion-mark" aria-hidden="true">
          <Icon name="skill" size={18} />
        </span>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {result ? (
          <div key={result.roll_id} className="simple-result-reveal">
            <div className="result-head">
              <div>
                <span className="eyebrow">RESULTADO</span>
                <div className="big-number">
                  {result.total}
                  {result.mode === 'success' && (
                    <small>{result.total === 1 ? 'sucesso' : 'sucessos'}</small>
                  )}
                </div>
              </div>
              <span
                className={`status ${result.passed === undefined ? 'neutral' : result.passed ? 'good' : 'bad'}`}
              >
                {result.passed === undefined ? 'sem alvo' : result.passed ? 'passou' : 'falhou'}
              </span>
            </div>
            <div className="formula">
              {result.groups.length === 1
                ? describeDice(result.expression)
                : `${result.groups.length} grupos de dados`}
            </div>
            {result.groups.map((g, i) => (
              <div className="audit" key={i}>
                <div className="audit-label">
                  {result.groups.length === 1 ? 'Dados' : describeDice(g.raw)}
                  <span>{result.mode === 'success' ? g.successes : g.subtotal}</span>
                </div>
                <div className="dice-row">
                  {g.dice.map((d) => (
                    <span
                      className={d.kept ? 'die kept' : 'die'}
                      key={d.index}
                      style={{ '--die-delay': `${(d.index % 8) * 18}ms` } as CSSProperties}
                      title={`Faces: ${d.raw.join(' → ')}`}
                    >
                      {d.total}
                      {d.raw.length > 1 && <small>!</small>}
                    </span>
                  ))}
                  {i === result.groups.length - 1 && result.bonus !== 0 && (
                    <b
                      className="roll-inline-modifier"
                      aria-label={`Modificador ${result.bonus >= 0 ? '+' : ''}${result.bonus}`}
                    >
                      {result.bonus >= 0 ? '+' : ''}
                      {result.bonus}
                    </b>
                  )}
                </div>
              </div>
            ))}
            <div className="roll-id">
              ID {result.roll_id} · {new Date(result.created_at).toLocaleTimeString('pt-BR')}
            </div>
          </div>
        ) : (
          empty || (
            <div className="empty">
              <div className="empty-mark" aria-hidden="true">
                <Icon name="skill" size={42} />
              </div>
              <h3>Pronto para a próxima jogada.</h3>
              <p>Escolha a expressão e role seus dados.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
