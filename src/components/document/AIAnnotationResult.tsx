import type { AnnotationItem } from "@/stores/annotation.store";
import { useStyleStore, buildFontStack } from "@/stores/style.store";
import { renderBoldText } from "@/components/ui/render-bold";
import {
  getTranslation,
  getDefinitions,
  getCollocations,
  getIpa,
  getDifficulty,
  getRegister,
  getAlternatives,
  inferGranularity,
} from "@/lib/annotation-helpers";

interface AIAnnotationResultProps {
  item: AnnotationItem;
  /** AI data version to show as a tag (e.g. "v1"). Omit to hide. */
  version?: number;
  /** Show core content: translation + meta tags + definitions. */
  showCore?: boolean;
  /** Show detail sections: examples + collocations + alternatives. */
  showDetails?: boolean;
}

/**
 * Shared rendering of AI annotation analysis data.
 *
 * Used by both AITranslateCard (annotations tab) and StudyPanel
 * (learning modal) so that AI data format iteration only needs to
 * touch one component.
 *
 * - `showCore` controls the translation / meta tags / definitions block
 * - `showDetails` controls the examples / collocations / alternatives block
 * - FSRS stats are rendered by the caller directly so the animation
 *   wrapper in AITranslateCard can be placed around details only
 */
export function AIAnnotationResult({
  item,
  version,
  showCore = false,
  showDetails = false,
}: AIAnnotationResultProps) {
  const style = useStyleStore((s) => s.style);
  const ai = item.aiResult;
  if (!ai) return null;

  const translation = getTranslation(ai);
  const defs = getDefinitions(ai);
  const colls = getCollocations(ai);
  const ipa = getIpa(ai);
  const difficulty = getDifficulty(ai);
  const register = getRegister(ai);
  const alts = getAlternatives(ai);
  const examples = ai.examples ?? [];
  const granularity = inferGranularity(ai, item.text);
  const isWord = granularity === "word" || granularity === "phrase";

  return (
    <div
      className="space-y-1"
      style={{
        fontFamily: buildFontStack(style.fontFamilies),
        fontSize: style.fontSize,
      }}
    >
      {/* ── Core: translation + meta tags + definitions ── */}
      {showCore && (
        <>
          {translation && (
            <p className="font-medium text-primary leading-relaxed">
              {renderBoldText(translation)}
            </p>
          )}

          {(difficulty || (ipa && isWord) || register || version) && (
            <div className="flex flex-wrap gap-1">
              {difficulty && (
                <span className="inline-flex items-center rounded bg-rosewater/15 px-1.5 py-0.5 text-rosewater">
                  {difficulty}
                </span>
              )}
              {ipa && isWord && (
                <span className="inline-flex items-center rounded bg-flamingo/15 px-1.5 py-0.5 text-flamingo">
                  {ipa.startsWith("/") ? ipa : `/${ipa}/`}
                </span>
              )}
              {register && (
                <span className="inline-flex items-center rounded bg-lavender/15 px-1.5 py-0.5 text-lavender">
                  {register}
                </span>
              )}
              {version && (
                <span className="inline-flex items-center rounded bg-subtext/15 px-1.5 py-0.5 text-subtext">
                  v{version}
                </span>
              )}
            </div>
          )}

          {defs.length > 0 && (
            <div className="space-y-0.5">
              {defs.slice(0, 5).map((d: any, i) => (
                <div key={i} className="leading-relaxed">
                  {d.pos && (
                    <span className="inline-flex items-center rounded bg-peach/15 px-1.5 py-0.5 text-peach mr-1">
                      {d.pos}
                    </span>
                  )}
                  {d.definition && (
                    <span className="text-foreground">{d.definition}</span>
                  )}
                  {d.gloss && (
                    <span className="text-overlay0 ml-1">{d.gloss}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Details: examples + collocations + alternatives ── */}
      {showDetails && (
        <div className="space-y-1.5 text-muted-foreground border-t pt-1.5 leading-relaxed">
          {examples.length > 0 && (
            <div>
              <span className="font-bold text-peach flex items-center justify-center mb-0.5 text-center">
                Examples
              </span>
              <ul className="space-y-1">
                {examples.slice(0, 5).map((ex: any, i) => (
                  <li key={i}>
                    <span className="text-foreground">
                      {renderBoldText(ex.sentence)}
                    </span>
                    {ex.translation && (
                      <span className="text-overlay0 block ml-0">
                        {renderBoldText(ex.translation)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {colls.length > 0 && (
            <div>
              <span className="font-bold text-peach flex items-center justify-center mb-0.5 text-center">
                Collocations
              </span>
              <div className="space-y-0.5">
                {colls.map((c: any, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="font-medium text-foreground">
                      {c.phrase}
                    </span>
                    <span className="text-overlay0"> {c.translation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alts.length > 0 && (
            <div>
              <span className="font-bold text-peach flex items-center justify-center mb-0.5 text-center">
                Alternatives
              </span>
              <div className="space-y-0.5">
                {alts.map((a: any, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="font-medium text-foreground">
                      {a.expression}
                    </span>
                    {a.register && (
                      <span className="inline-flex items-center rounded bg-lavender/15 px-1.5 py-0.5 text-lavender ml-1">
                        {a.register}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
