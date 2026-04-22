import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Modal from './Modal'
import { formatCurrency } from '../../utils/formatters'
import type { QuoteVersion } from '../../hooks/useQuotes'

interface QuoteVersionHistoryProps {
  open: boolean
  onClose: () => void
  versions: QuoteVersion[]
  currentVersion?: QuoteVersion
}

export default function QuoteVersionHistory({
  open,
  onClose,
  versions,
  currentVersion,
}: QuoteVersionHistoryProps) {
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null)

  // Show current version first (if not already in history), then history in reverse chronological order
  const allVersions = currentVersion
    ? [currentVersion, ...versions.filter(v => v.versionNum !== currentVersion.versionNum)]
    : versions

  const sortedVersions = allVersions.sort((a, b) => b.versionNum - a.versionNum)

  return (
    <Modal open={open} onClose={onClose} title="Quote Version History">
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sortedVersions.length === 0 ? (
          <p className="text-cream/50 text-sm text-center py-8">No version history yet</p>
        ) : (
          sortedVersions.map((version, idx) => {
            const isExpanded = expandedVersion === version.versionNum
            const isCurrent = currentVersion && version.versionNum === currentVersion.versionNum

            // Get the previous version for diff calculation
            const prevVersion = sortedVersions[idx + 1]

            return (
              <div key={`v${version.versionNum}`} className="border border-white/10 rounded-lg overflow-hidden">
                {/* Header — clickable */}
                <button
                  onClick={() => setExpandedVersion(isExpanded ? null : version.versionNum)}
                  className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-between"
                >
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gold font-semibold">
                        v{version.versionNum}
                      </span>
                      {isCurrent && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300">
                          current
                        </span>
                      )}
                      <span className="text-xs text-cream/40">
                        {new Date(version.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-sm text-cream/70 mt-1">
                      Total: <span className="text-gold font-semibold">{formatCurrency(version.total)}</span>
                      <span className="text-cream/40 mx-2">·</span>
                      Deposit: {formatCurrency(version.deposit)}
                      <span className="text-cream/40 mx-2">·</span>
                      Status: <span className={`text-xs px-1.5 rounded font-medium ${
                        version.status === 'accepted' ? 'bg-green-500/20 text-green-300' :
                        version.status === 'sent'     ? 'bg-blue-500/20 text-blue-300' :
                        version.status === 'declined' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-white/5 text-cream/40'
                      }`}>{version.status}</span>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-cream/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Expanded body — show full snapshot + diff */}
                {isExpanded && (
                  <div className="px-4 py-3 border-t border-white/5 space-y-3 bg-navy-lighter/30">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-cream/40 text-xs">Total</span>
                        <p className="text-gold font-semibold text-base">{formatCurrency(version.total)}</p>
                      </div>
                      <div>
                        <span className="text-cream/40 text-xs">Deposit</span>
                        <p className="text-cream/80 font-medium">{formatCurrency(version.deposit)}</p>
                      </div>
                      <div>
                        <span className="text-cream/40 text-xs">Balance</span>
                        <p className="text-cream/80 font-medium">{formatCurrency(version.balance)}</p>
                      </div>
                      <div>
                        <span className="text-cream/40 text-xs">Status</span>
                        <p className={`text-xs px-2 py-1 rounded w-fit font-medium ${
                          version.status === 'accepted' ? 'bg-green-500/20 text-green-300' :
                          version.status === 'sent'     ? 'bg-blue-500/20 text-blue-300' :
                          version.status === 'declined' ? 'bg-red-500/20 text-red-400' :
                                                          'bg-white/5 text-cream/40'
                        }`}>{version.status}</p>
                      </div>
                    </div>

                    {/* Show diff with previous version */}
                    {prevVersion && (
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-xs text-cream/40 mb-2 font-medium">Changes from v{prevVersion.versionNum}:</p>
                        <div className="space-y-1 text-xs text-cream/60">
                          {version.total !== prevVersion.total && (
                            <p>
                              Total: <span className="text-cream/40">{formatCurrency(prevVersion.total)}</span>
                              <span className="text-cream/30 mx-1">→</span>
                              <span className="text-gold">{formatCurrency(version.total)}</span>
                            </p>
                          )}
                          {version.deposit !== prevVersion.deposit && (
                            <p>
                              Deposit: <span className="text-cream/40">{formatCurrency(prevVersion.deposit)}</span>
                              <span className="text-cream/30 mx-1">→</span>
                              <span className="text-cream/80">{formatCurrency(version.deposit)}</span>
                            </p>
                          )}
                          {version.balance !== prevVersion.balance && (
                            <p>
                              Balance: <span className="text-cream/40">{formatCurrency(prevVersion.balance)}</span>
                              <span className="text-cream/30 mx-1">→</span>
                              <span className="text-cream/80">{formatCurrency(version.balance)}</span>
                            </p>
                          )}
                          {version.status !== prevVersion.status && (
                            <p>
                              Status: <span className="text-cream/40">{prevVersion.status}</span>
                              <span className="text-cream/30 mx-1">→</span>
                              <span className="text-cream/80">{version.status}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-cream/40 pt-1">
                      Created: {new Date(version.created_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </Modal>
  )
}
