"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Helper for formatting numbers
const formatStat = (num) => (num !== null && num !== undefined ? num.toFixed(1) : '0.0');

// Main Component
function PlayerStatsTable({ initialSeason = 2024 }) {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [season, setSeason] = useState(initialSeason); // State for season (setSeason is unused for now)
    const [scoringSystem, setScoringSystem] = useState('UD'); // 'UD' or 'DK'
    const [sortConfig, setSortConfig] = useState({ key: 'ud_fp', direction: 'descending' });

    // --- Sorting Logic (define before fetchData as fetchData depends on it) ---
    const sortData = useCallback((data, config) => {
        if (!config.key) return data;

        const sorted = [...(data || [])].sort((a, b) => {
            let aValue = a[config.key];
            let bValue = b[config.key];

            // Handle sorting player names (string)
            if (config.key === 'first_name') {
                aValue = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
                bValue = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
            } else {
                 // Ensure numeric comparison, treating null/undefined as -Infinity for descending sort
                 aValue = aValue ?? (config.direction === 'descending' ? -Infinity : Infinity);
                 bValue = bValue ?? (config.direction === 'descending' ? -Infinity : Infinity);
            }


            if (aValue < bValue) {
                return config.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return config.direction === 'ascending' ? 1 : -1;
            }
            return 0; // Keep original order if values are equal
        });
        return sorted;
    }, []); // Empty dependency array as sortData logic itself doesn't change


    // --- Data Fetching ---
    const fetchData = useCallback(async (fetchSeason) => {
        setLoading(true);
        setError(null);
        // Don't clear stats immediately, provides better UX on re-fetch/sort
        // setStats([]);
        try {
            // Use relative path for API route - Next.js handles this
            const response = await fetch(`/api/nba/season-stats?season=${fetchSeason}`);
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (parseError) {
                    // If response is not JSON, log the parsing error
                    console.error("Failed to parse error response:", parseError);
                    errorData = { message: `HTTP error! status: ${response.status}` };
                }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Apply initial sort config when data arrives
            const initialSortKey = scoringSystem === 'UD' ? 'ud_fp' : 'dk_fp';
            const initialConfig = { key: initialSortKey, direction: 'descending' };
            setStats(sortData(data.data || [], initialConfig)); // Use sortData here
            setSortConfig(initialConfig); // Set the sort config state

        } catch (e) {
            console.error("Failed to fetch stats:", e);
            setError(e.message || "Failed to load data.");
            setStats([]); // Clear stats on error
        } finally {
            setLoading(false);
        }
    // Update dependency array: fetchData uses sortData
    }, [sortData, scoringSystem]); // Include scoringSystem because it's used to determine initialSortKey

    // Initial fetch and re-fetch when season changes
    useEffect(() => {
        fetchData(season);
    }, [season, fetchData]); // Depend on season and the fetchData function itself


    // Request sorting when header is clicked
    const requestSort = useCallback((key) => {
        let direction = 'descending'; // Default desc for stats
         // Default asc for text columns
         if (['first_name', 'team_abbreviation', 'position'].includes(key)) {
             direction = 'ascending';
         }

        // Toggle direction if same key is clicked
        if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        } else if (sortConfig.key === key && sortConfig.direction === 'ascending') {
             direction = 'descending';
        }

        const newSortConfig = { key, direction };
        setSortConfig(newSortConfig);
        setStats(prevStats => sortData(prevStats, newSortConfig)); // Re-sort existing data
    }, [sortConfig, sortData]); // Depend on current sortConfig and the sortData function


    // --- Dynamic Columns based on Scoring System ---
    const fantasyPointsKey = useMemo(() => (scoringSystem === 'UD' ? 'ud_fp' : 'dk_fp'), [scoringSystem]);
    const fantasyPointsHeader = useMemo(() => (scoringSystem === 'UD' ? 'UD FP' : 'DK FP'), [scoringSystem]);

    // Define table columns
    const columns = useMemo(() => [
        { key: 'first_name', label: 'Player', sortable: true, sticky: true, className: "sticky left-0 bg-white dark:bg-gray-800 z-10 whitespace-nowrap px-4 py-2 font-medium text-gray-900 dark:text-white" }, // Sticky Player Name
        { key: 'team_abbreviation', label: 'Team', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'position', label: 'Pos', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'gp', label: 'GP', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'min', label: 'MIN', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'pts', label: 'PTS', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'reb', label: 'REB', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'ast', label: 'AST', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'stl', label: 'STL', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'blk', label: 'BLK', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'turnover', label: 'TOV', sortable: true, className: "px-4 py-2 whitespace-nowrap" },
        { key: fantasyPointsKey, label: fantasyPointsHeader, sortable: true, className: "px-4 py-2 whitespace-nowrap font-semibold" }, // Dynamic FP column
    ], [fantasyPointsKey, fantasyPointsHeader]); // Columns depend on the dynamic FP key/header


    // --- Render ---
    return (
        <div className="p-4 md:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen font-sans">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">NBA Player Season Averages ({season}-{season+1})</h1>

            {/* Controls */}
             <div className="mb-6 flex flex-wrap items-center gap-4">
                 {/* Scoring System Selector */}
                <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                     <span className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-2">Scoring:</span>
                     <button
                         onClick={() => {
                             setScoringSystem('UD');
                             // Re-sort by the new default FP column when system changes
                             requestSort('ud_fp');
                         }}
                         className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-150 ${scoringSystem === 'UD' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                     >
                         Underdog
                     </button>
                     <button
                         onClick={() => {
                             setScoringSystem('DK');
                             requestSort('dk_fp');
                         }}
                         className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-150 ${scoringSystem === 'DK' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                     >
                         DraftKings
                     </button>
                 </div>
                  {/* Add Season Selector Here Later */}
                  {/* Add Search Bar Here Later */}
             </div>


            {/* Status Indicators */}
            {loading && <div className="text-center py-10 text-gray-600 dark:text-gray-400">Loading player stats...</div>}
            {error && <div className="text-center py-10 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-4 rounded-lg">Error: {error}</div>}

            {/* Table Container */}
            {!loading && !error && stats.length === 0 && (
                <div className="text-center py-10 text-gray-600 dark:text-gray-400">No player data found for the {season}-{season+1} season.</div>
            )}

            {!loading && !error && stats.length > 0 && (
                 // Container for sticky header/column table
                 // overflow-auto allows both vertical and horizontal scrolling
                 // max-h-[calc(100vh-250px)] or similar controls max table height before body scrolls
                <div className="overflow-auto shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 relative max-h-[calc(100vh-250px)]">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 table-fixed md:table-auto"> {/* Use table-fixed for more control if needed, or table-auto */}
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-20"> {/* Sticky Header */}
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        // Apply base padding/alignment here, specific overrides in col.className
                                        className={`px-4 py-3 ${col.sortable ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600' : ''} ${col.sticky ? 'sticky left-0 z-10 bg-gray-100 dark:bg-gray-700' : ''}`} // Apply sticky class slightly differently for header
                                        onClick={() => col.sortable && requestSort(col.key)}
                                        style={col.key === 'first_name' ? { width: '180px' } : {}} // Example fixed width for player name
                                    >
                                        <div className="flex items-center">
                                            {col.label}
                                            {/* Sort Indicator */}
                                            {col.sortable && (
                                                <span className="ml-1 text-gray-400">
                                                  {sortConfig.key === col.key
                                                     ? (sortConfig.direction === 'ascending' ? '▲' : '▼')
                                                     : '↕' // Indicate sortable but not active
                                                  }
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        {/* Table Body */}
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {stats.map((player) => (
                                <tr key={player.player_id} className="hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors duration-100">
                                     {columns.map((col) => (
                                         <td
                                             key={`${player.player_id}-${col.key}`}
                                             className={col.className} // Use className defined in columns config
                                         >
                                            {col.key === 'first_name'
                                                ? `${player.first_name} ${player.last_name}`
                                                // Format numeric stats, handle non-numeric ones gracefully
                                                : (typeof player[col.key] === 'number'
                                                      ? formatStat(player[col.key])
                                                      : (player[col.key] ?? 'N/A')) // Display 'N/A' for null/undefined non-numeric fields
                                            }
                                        </td>
                                     ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default PlayerStatsTable;