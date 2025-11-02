'use client'

type Props = {
  missingRequired?: string[]
  missingPreferred?: string[]
  presentRequired?: string[]
  presentPreferred?: string[]
}

const SPECIAL: Record<string, string> = {
  '.net': '.NET',
  'node.js': 'Node.js',
  'next.js': 'Next.js',
  'react.js': 'React.js',
  'react': 'React',
  'postgresql': 'PostgreSQL',
  'microsoft excel': 'Microsoft Excel',
  'microsoft word': 'Microsoft Word',
  'epic clarity': 'Epic Clarity',
  'cerner': 'Cerner',
  'hipaa': 'HIPAA',
  'icd-10': 'ICD-10',
  'cpt': 'CPT',
  'hcpcs': 'HCPCS',
  'eob': 'EOB',
  'era': 'ERA',
  'ehr': 'EHR',
  'aws': 'AWS',
  'gcp': 'GCP',
  'azure': 'Azure',
  'sql': 'SQL',
  'ci/cd': 'CI/CD',
  'api': 'API',
  'nlp': 'NLP',
  'llm': 'LLM',
};

const ACRONYMS = new Set([
  'api','sql','aws','gcp','hipaa','cpt','hcpcs','eob','era','ehr','nlp','llm','ci/cd','gpu','cpu','sme'
]);

function capToken(tok: string): string {
  const l = tok.toLowerCase();
  if (SPECIAL[l]) return SPECIAL[l];

  // handle separators inside a token
  if (l.includes('/')) return l.split('/').map(capToken).join('/');
  if (l.includes('-')) return l.split('-').map(capToken).join('-');
  if (l.includes('.')) return l.split('.').map(s => s ? s[0].toUpperCase() + s.slice(1) : s).join('.');

  if (ACRONYMS.has(l)) return l.toUpperCase();
  return l ? l[0].toUpperCase() + l.slice(1) : l;
}

function prettyLabel(k: string): string {
  // exact phrase mapping first
  const l = k.toLowerCase().trim();
  if (SPECIAL[l]) return SPECIAL[l];
  return l.split(' ').map(capToken).join(' ');
}

export default function KeywordHints({
  missingRequired = [],
  missingPreferred = [],
  presentRequired = [],
  presentPreferred = [],
}: Props) {
  const copy = (list: string[]) => {
    if (!list.length) return;
    const pretty = list.map(prettyLabel).join(', ');
    navigator?.clipboard?.writeText(pretty);
  };

  const Chip = ({ text }: { text: string }) => (
    <span className="inline-block px-2 py-1 rounded-lg text-xs bg-gray-100 border mr-2 mb-2">
      {text}
    </span>
  );

  return (
    <div className="rounded-2xl border p-4 bg-white space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Keyword Insights</h3>
        <div className="text-xs text-gray-500">Required ×3 weight · Preferred ×1</div>
      </div>

      {/* Missing required */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">Missing (Must-have)</h4>
          <button
            onClick={() => copy(missingRequired)}
            className="text-xs underline"
            disabled={!missingRequired.length}
            title="Copy to clipboard"
          >
            Copy
          </button>
        </div>
        {missingRequired.length ? (
          <div>{missingRequired.map((k) => <Chip key={`mr-${k}`} text={prettyLabel(k)} />)}</div>
        ) : (
          <div className="text-sm text-green-600">Great — all required terms covered.</div>
        )}
      </div>

      {/* Missing preferred */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">Missing (Nice-to-have)</h4>
          <button
            onClick={() => copy(missingPreferred)}
            className="text-xs underline"
            disabled={!missingPreferred.length}
            title="Copy to clipboard"
          >
            Copy
          </button>
        </div>
        {missingPreferred.length ? (
          <div>{missingPreferred.map((k) => <Chip key={`mp-${k}`} text={prettyLabel(k)} />)}</div>
        ) : (
          <div className="text-sm text-green-600">Nice — preferred terms covered.</div>
        )}
      </div>

      {/* Present (collapsible) */}
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-gray-600">Show present keywords</summary>
        <div className="mt-3">
          <div className="mb-2 text-sm font-medium">Required found</div>
          <div className="mb-3">
            {presentRequired.length
              ? presentRequired.map((k) => <Chip key={`pr-${k}`} text={prettyLabel(k)} />)
              : <span className="text-sm text-gray-500">None</span>}
          </div>

          <div className="mb-2 text-sm font-medium">Preferred found</div>
          <div>
            {presentPreferred.length
              ? presentPreferred.map((k) => <Chip key={`pp-${k}`} text={prettyLabel(k)} />)
              : <span className="text-sm text-gray-500">None</span>}
          </div>
        </div>
      </details>
    </div>
  )
}
