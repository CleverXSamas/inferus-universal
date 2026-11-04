import { useEffect, useRef, useState } from 'react';
import type { RollRecord } from '../packages/dice-core';
import { Icon } from './editor-shared';
import { RollCard } from './RollCard';
export type SheetRoll = {
  result: RollRecord | null;
  name: string;
  expression: string;
  error?: string;
};
export function SheetRollDock({
  roll,
  onRoll,
  onClose,
  focusInput = false,
}: {
  roll: SheetRoll;
  onRoll: (expression: string, name: string) => void;
  onClose: () => void;
  focusInput?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [expression, setExpression] = useState(roll.expression);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setCollapsed(false);
    setExpression(roll.expression);
  }, [roll]);
  useEffect(() => {
    if (focusInput) input.current?.focus({ preventScroll: true });
  }, [focusInput]);
  const title = expression === roll.expression ? roll.name : 'Rolagem de dados';
  return (
    <section
      className={`sheet-roll-dock ${collapsed ? 'is-collapsed' : ''}`}
      role="region"
      aria-label="Rolagem da ficha"
    >
      <div className="sheet-roll-dock-heading">
        <Icon name="skill" size={21} />
        <div>
          <span>DADOS DA FICHA</span>
          <b>
            {collapsed && roll.result ? `${roll.name} · ${roll.result.total}` : 'Sua última jogada'}
          </b>
        </div>
        <button
          className="icon-btn"
          aria-label={collapsed ? 'Expandir rolagem' : 'Recolher rolagem'}
          aria-expanded={!collapsed}
          aria-controls="sheet-roll-dock-content"
          onClick={() => setCollapsed((v) => !v)}
        >
          <Icon name={collapsed ? 'plus' : 'minus'} size={16} />
        </button>
        <button className="icon-btn" aria-label="Fechar rolagem" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <div id="sheet-roll-dock-content" hidden={collapsed} className="sheet-roll-dock-content">
        <div className="sheet-roll-dock-result">
          {roll.error ? (
            <div className="sheet-roll-error" role="alert">
              <b>Vamos ajustar a jogada.</b>
              <p>{roll.error}</p>
            </div>
          ) : (
            <RollCard result={roll.result} reason={roll.name} expression={roll.expression} />
          )}
        </div>
        <form
          className="sheet-roll-dock-form"
          onSubmit={(e) => {
            e.preventDefault();
            input.current?.blur();
            onRoll(expression, title);
          }}
        >
          <label htmlFor="sheet-roll-expression">Expressão dos dados da ficha</label>
          <div>
            <input
              ref={input}
              id="sheet-roll-expression"
              value={expression}
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setExpression(e.target.value)}
            />
            <button type="submit">Rolar</button>
          </div>
          <div className="sheet-dice-presets">
            {[
              ['1d20', 'd20'],
              ['1d6', 'd6'],
              ['4d6kh3', 'Atributos'],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => {
                  setExpression(value);
                  onRoll(
                    value,
                    label === 'Atributos' ? 'Rolagem de atributos' : 'Rolagem de dados',
                  );
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </form>
      </div>
      <span className="sr-only" role="status" aria-label="Resultado da rolagem">
        {roll.result ? `${roll.name}: ${roll.result.total} · ${roll.result.expression}` : ''}
      </span>
    </section>
  );
}
