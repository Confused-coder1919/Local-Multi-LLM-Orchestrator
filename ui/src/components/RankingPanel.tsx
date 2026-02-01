import type { AggregatedRankingEntry } from '../api';
import CollapsibleCard from './CollapsibleCard';

interface RankingPanelProps {
  ranking: AggregatedRankingEntry[];
}

export default function RankingPanel({ ranking }: RankingPanelProps) {
  return (
    <CollapsibleCard title="Aggregated Ranking">
      {!ranking.length ? (
        <div className="muted">No ranking yet.</div>
      ) : (
        <table className="ranking-table">
          <thead>
            <tr>
              <th>Anon ID</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((entry) => (
              <tr key={entry.anon_id}>
                <td className="mono">{entry.anon_id}</td>
                <td>{entry.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CollapsibleCard>
  );
}
