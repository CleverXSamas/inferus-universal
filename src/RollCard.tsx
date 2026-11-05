import { useRollAnimation } from './dice-feedback';
import type { CSSProperties } from 'react';
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
  const moving = useRollAnimation(result?.roll_id);
  return (
    <div className={`roll-card ${moving ? 'is-roll-animating' : ''}`} data-testid="roll-card">
      {result && (
        <img
          key={result.roll_id}
          className="roll-card-flourish"
          src={`/assets/inferus-roll.gif?roll=${encodeURIComponent(result.roll_id)}`}
          width={68}
          height={68}
          alt=""
          aria-hidden="true"
        />
      )}
      <span className="roll-card-title">{card?.title || reason || 'Rolagem de dados'}</span>
      <strong className="roll-card-total">
        {card ? card.total : '—'}
        {card?.unit && <small>{card.unit}</small>}
      </strong>
      <span className="roll-card-description">
        {card?.description ||
          (expression ? 'Teste uma expressão para ver os dados' : 'Seus dados aparecem aqui')}
      </span>
      {card ? (
        <>
          <div className="roll-card-groups">
            {card.groups.map((g, i) => (
              <div className="roll-card-group" key={i}>
                {card.groups.length > 1 && (
                  <small className="roll-card-group-label">{g.label}</small>
                )}
                <div className="roll-card-dice">
                  {g.dice.map((d, j) => (
                    <span
                      className={d.kept ? 'kept' : 'discarded'}
                      key={j}
                      style={{ '--die-delay': `${(j % 8) * 18}ms` } as CSSProperties}
                      title={`${d.raw.join(' + ')}${d.omittedFaces ? ' + …' : ''}`}
                    >
                      {d.total}
                      {d.raw.length > 1 ? '!' : ''}
                    </span>
                  ))}
                  {i === card.groups.length - 1 && result!.bonus !== 0 && (
                    <b className="roll-inline-modifier" aria-label={`Modificador ${card.modifier}`}>
                      {card.modifier}
                    </b>
                  )}
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
          {card.target !== undefined && (
            <div className="roll-card-meta">
              <span>
                Alvo {card.target} <b>{card.passed ? 'Passou' : 'Não atingiu'}</b>
              </span>
            </div>
          )}
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
