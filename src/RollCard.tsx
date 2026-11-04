import type { RollRecord } from '../packages/dice-core';
import { rollCardModel, ROLL_LEGEND } from '../packages/discord-ui';
export function RollCard({
  result,
  reason = '',
  expression = '',
}: {
  result: RollRecord | null;
  reason?: string;
  expression?: string;
}) {
  const card = result ? rollCardModel(result, reason) : null;
  return (
    <div className="roll-card" data-testid="roll-card">
      <span className="roll-card-title">{card?.title || reason || 'Rolagem de dados'}</span>
      <strong className="roll-card-total">
        {card ? card.total : '—'}
        {card?.unit && <small>{card.unit}</small>}
      </strong>
      <code className="roll-card-expression">{card?.expression || expression}</code>
      {card ? (
        <>
          <div className="roll-card-groups">
            {card.groups.map((g, i) => (
              <div className="roll-card-group" key={i}>
                <code>{g.expression}</code>
                <div className="roll-card-dice">
                  {g.dice.map((d, j) => (
                    <span
                      className={d.kept ? 'kept' : 'discarded'}
                      key={j}
                      title={`${d.raw.join(' + ')}${d.omittedFaces ? ' + …' : ''}`}
                    >
                      {d.total}
                      {d.raw.length > 1 ? '!' : ''}
                    </span>
                  ))}
                </div>
                {g.omitted > 0 && (
                  <small className="roll-card-note">… {g.omitted} dados omitidos.</small>
                )}
                {g.explosions && (
                  <small className="roll-card-note">Explosões: {g.explosions}</small>
                )}
              </div>
            ))}
            {card.omittedGroups > 0 && (
              <small className="roll-card-note">
                Mais {card.omittedGroups} grupos omitidos para manter a leitura.
              </small>
            )}
          </div>
          <div className="roll-card-meta">
            <span>
              Modificador <b>{card.modifier}</b>
            </span>
            {card.target !== undefined && (
              <span>
                Alvo {card.target} <b>{card.passed ? 'Passou' : 'Não atingiu'}</b>
              </span>
            )}
          </div>
          <small className="roll-card-legend">{ROLL_LEGEND}</small>
        </>
      ) : (
        <p className="roll-card-placeholder">
          Role os dados para conferir o resultado e cada modificador.
        </p>
      )}
    </div>
  );
}
