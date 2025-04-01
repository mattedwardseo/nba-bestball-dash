// Added Player Search Input and Client-Side Filtering

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Helper for formatting numbers
const formatStat = (num) => (num !== null && num !== undefined ? num.toFixed(1) : '0.0');

// Define available seasons
const availableSeasons = [2024, 2023, 2022];

// Main Component
function PlayerStatsTable({ initialSeason = 2024 }) {
    // Rename 'stats' to 'allStats' to hold the full dataset
    const [allStats, setAllStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [season, setSeason] = useState(initialSeason);
    const [scoringSystem, setScoringSystem] = useState('UD');
    const [sortConfig, setSortConfig] = useState({ key: 'ud_fp', direction: 'descending' });
    // NEW: State for the search query
    const [searchQuery, setSearchQuery] = useState('');

    // --- Sorting Logic (operates on the full dataset) ---
    const sortData = useCallback((data, config) => {
        if (!config?.key) return data; // Add null check for config
        const sorted = [...(data || [])].sort((a, b) => {
            let aValue = a[config.key];
            let bValue = b[config.key];
            if (config.key === 'first_name') { aValue = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase(); bValue = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase(); }
            else { aValue = aValue ?? (config.direction === 'descending' ? -Infinity : Infinity); bValue = bValue ?? (config.direction === 'descending' ? -Infinity : Infinity); }
            if (aValue < bValue) { return config.direction === 'ascending' ? -1 : 1; }
            if (aValue > bValue) { return config.direction === 'ascending' ? 1 : -1; }
            return 0;
        });
        return sorted;
    }, []); // Empty dependency array is correct here

    // --- Data Fetching ---
    const fetchData = useCallback(async (fetchSeason) => {
        if (isNaN(parseInt(fetchSeason, 10))) { console.error("Invalid season provided to fetchData:", fetchSeason); setError("Invalid season selected."); setAllStats([]); setLoading(false); return; }
        console.log(`Fetching data for season: ${fetchSeason}`);
        setLoading(true); setError(null); setSearchQuery(''); // Reset search on new season fetch
        try {
            const response = await fetch(`/api/nba/season-stats?season=${fetchSeason}`);
            if (!response.ok) { let errorData; try { errorData = await response.json(); } catch (parseError) { console.error("Failed to parse error response:", parseError); errorData = { message: `HTTP error! status: ${response.status}` }; } throw new Error(errorData.message || `HTTP error! status: ${response.status}`); }
            const data = await response.json();
            console.log(`Data received for season ${fetchSeason}, processing...`);
            // Apply initial sort config when data arrives & store in allStats
            const initialSortKey = scoringSystem === 'UD' ? 'ud_fp' : 'dk_fp';
            const initialConfig = { key: initialSortKey, direction: 'descending' };
            setAllStats(sortData(data.data || [], initialConfig)); // Sort and store full dataset
            setSortConfig(initialConfig); // Set the sort config state
        } catch (e) { console.error("Failed to fetch stats:", e); setError(e.message || "Failed to load data."); setAllStats([]); }
        finally { setLoading(false); console.log(`Finished fetching/processing for season: ${fetchSeason}`); }
    // Depend only on sortData and scoringSystem (for initial sort key)
    }, [sortData, scoringSystem]);

    // Initial fetch and re-fetch when season changes
    useEffect(() => {
        fetchData(season);
    }, [season, fetchData]);

    // --- Filtering Logic ---
    const filteredStats = useMemo(() => {
        if (!searchQuery) {
            return allStats; // No search query? Return all stats
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return allStats.filter(player => {
            const fullName = `${player.first_name || ''} ${player.last_name || ''}`.toLowerCase();
            return fullName.includes(lowerCaseQuery);
        });
    // Re-filter whenever the full dataset or the search query changes
    }, [allStats, searchQuery]);

    // --- Event Handlers ---
    const handleSeasonChange = (event) => { /* ... (no changes) ... */ const newSeason = parseInt(event.target.value, 10); if (!isNaN(newSeason)) { console.log("Season changed to:", newSeason); setSeason(newSeason); } };
    const handleScoringChange = (system) => { /* ... (no changes) ... */ setScoringSystem(system); const newSortKey = system === 'UD' ? 'ud_fp' : 'dk_fp'; requestSort(newSortKey); };

    // Request sorting (now updates allStats)
    const requestSort = useCallback((key) => {
        let direction = 'descending';
        if (['first_name', 'team_abbreviation', 'position'].includes(key)) { direction = 'ascending'; }
        if (sortConfig.key === key && sortConfig.direction === 'descending') { direction = 'ascending'; }
        else if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
        const newSortConfig = { key, direction };
        setSortConfig(newSortConfig);
        // Sort the *entire* dataset when requested
        setAllStats(prevAllStats => sortData(prevAllStats, newSortConfig));
    }, [sortConfig, sortData]); // Depend on current sortConfig and the sortData function

    // --- Dynamic Columns ---
    const fantasyPointsKey = useMemo(() => (scoringSystem === 'UD' ? 'ud_fp' : 'dk_fp'), [scoringSystem]);
    const fantasyPointsHeader = useMemo(() => (scoringSystem === 'UD' ? 'UD FP' : 'DK FP'), [scoringSystem]);
    const columns = useMemo(() => [ /* ... (no changes) ... */ { key: 'first_name', label: 'Player', sortable: true, sticky: true, className: "sticky left-0 bg-white dark:bg-gray-800 z-10 whitespace-nowrap px-4 py-2 font-medium text-gray-900 dark:text-white" }, { key: 'team_abbreviation', label: 'Team', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: 'position', label: 'Pos', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: 'gp', label: 'GP', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: 'min', label: 'MIN', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: 'pts', label: 'PTS', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: 'reb', label: 'REB', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: 'ast', label: 'AST', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: 'stl', label: 'STL', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: 'blk', label: 'BLK', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: 'turnover', label: 'TOV', sortable: true, className: "px-4 py-2 whitespace-nowrap" }, { key: fantasyPointsKey, label: fantasyPointsHeader, sortable: true, className: "px-4 py-2 whitespace-nowrap font-semibold" }, ], [fantasyPointsKey, fantasyPointsHeader]);

    // --- Render ---
    return (
        <div className="p-4 md:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen font-sans">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">NBA Player Season Averages ({season}-{season+1})</h1>

            {/* Controls */}
             <div className="mb-6 flex flex-wrap items-center gap-4">
                 {/* Scoring System Selector */}
                <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                     {/* ... (scoring buttons - no changes) ... */}
                     <span className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-2">Scoring:</span>
                     <button onClick={() => handleScoringChange('UD')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-150 ${scoringSystem === 'UD' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>Underdog</button>
                     <button onClick={() => handleScoringChange('DK')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-150 ${scoringSystem === 'DK' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>DraftKings</button>
                 </div>

                 {/* Season Selector */}
                 <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                    {/* ... (season select - no changes) ... */}
                    <label htmlFor="season-select" className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-2">Season:</label>
                    <select id="season-select" value={season} onChange={handleSeasonChange} className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm py-1 pl-3 pr-8">
                        {availableSeasons.map((year) => ( <option key={year} value={year}> {year}-{year + 1} </option> ))}
                    </select>
                 </div>

                 {/* === NEW: Player Search Input === */}
                 <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                    <label htmlFor="player-search" className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-1">Search:</label>
                    <input
                        type="text"
                        id="player-search"
                        placeholder="Player name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm py-1 px-3"
                    />
                 </div>
             </div>

            {/* Status Indicators & Table */}
            {/* ... (loading, error messages - no changes) ... */}
             {loading && <div className="text-center py-10 text-gray-600 dark:text-gray-400">Loading player stats for {season}-{season+1}...</div>}
             {error && <div className="text-center py-10 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-4 rounded-lg">Error: {error}</div>}

            {/* Message when no data matches filters */}
             {!loading && !error && filteredStats.length === 0 && allStats.length > 0 && (
                <div className="text-center py-10 text-gray-600 dark:text-gray-400">No players found matching "{searchQuery}".</div>
             )}
             {/* Message when no data exists for the season */}
             {!loading && !error && allStats.length === 0 && (
                <div className="text-center py-10 text-gray-600 dark:text-gray-400">No player data found for the {season}-{season+1} season. (Have you run the update script for this season?)</div>
             )}

            {/* Render table only if not loading, no error, and filteredStats exist */}
            {!loading && !error && filteredStats.length > 0 && (
                 <div className="overflow-auto shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 relative max-h-[calc(100vh-250px)]">
                     <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 table-fixed md:table-auto">
                         <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-20">
                             {/* ... (thead - no changes) ... */}
                             <tr> {columns.map((col) => ( <th key={col.key} scope="col" className={`px-4 py-3 ${col.sortable ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600' : ''} ${col.sticky ? 'sticky left-0 z-10 bg-gray-100 dark:bg-gray-700' : ''}`} onClick={() => col.sortable && requestSort(col.key)} style={col.key === 'first_name' ? { width: '180px' } : {}}> <div className="flex items-center"> {col.label} {col.sortable && (<span className="ml-1 text-gray-400">{sortConfig.key === col.key ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}</span>)} </div> </th> ))} </tr>
                         </thead>
                         {/* UPDATE: Map over filteredStats instead of stats */}
                         <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                             {filteredStats.map((player) => (
                                 <tr key={player.player_id} className="hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors duration-100">
                                     {columns.map((col) => (
                                         <td key={`${player.player_id}-${col.key}`} className={col.className}>
                                             {col.key === 'first_name' ? `${player.first_name} ${player.last_name}` : (typeof player[col.key] === 'number' ? formatStat(player[col.key]) : (player[col.key] ?? 'N/A'))}
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