import type { ReleaseNoteInfo } from "builder-util-runtime";

interface ReleaseNotesViewProps {
  releaseNotes: string | Array<ReleaseNoteInfo> | null;
}

const HTML_STYLES =
  "[&_a]:text-ctp-mauve [&_a]:underline [&_code]:bg-ctp-surface0 [&_code]:px-1 [&_code]:rounded [&_img]:max-w-full [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:font-bold [&_h1]:text-base [&_h2]:font-bold [&_h3]:font-bold";

export function ReleaseNotesView({ releaseNotes }: ReleaseNotesViewProps) {
  if (releaseNotes == null) return null;

  if (typeof releaseNotes === "string") {
    return (
      <div className="max-h-60 overflow-y-auto rounded bg-ctp-base/50 p-2 text-xs text-ctp-text">
        <div
          className={HTML_STYLES}
          dangerouslySetInnerHTML={{ __html: releaseNotes }}
        />
      </div>
    );
  }

  return (
    <div className="max-h-60 overflow-y-auto rounded bg-ctp-base/50 p-2 text-xs text-ctp-text">
      <div className="space-y-4">
        {releaseNotes.map((rn, i) => (
          <div key={i}>
            <strong className="text-ctp-green">v{rn.version}</strong>
            {rn.note && (
              <div
                className={`mt-0.5 ${HTML_STYLES}`}
                dangerouslySetInnerHTML={{ __html: rn.note }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
