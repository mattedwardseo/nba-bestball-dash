// Fixed rendering for non-numeric columns (Team, Position)

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Helper for formatting numbers - updated for different views
const formatStat = (num, key, viewMode) => {
    // Added checks for Infinity and isNaN at the start
    if (num === null || num === undefined || !isFinite(num)) {
        // Handle GP specifically if null/undefined/Infinity/NaN
        return key === 'gp' ? '0' : '0.0';
    }
    // Format GP (always total) as integer
    if (key === 'gp') {
        return Math.round(num).toString();
    }
    // Format totals as integers (except FP totals and total_min)
    if (viewMode === 'totals' && !key.includes('_fp') && key !== 'total_min') {
         return Math.round(num).toString();
    }
     // Format Per Minute with 2 decimals (or more if needed)
     if (viewMode === 'perMinute') {
         // Handle very small numbers potentially needing more precision
         return num < 0.01 && num > 0 ? num.toFixed(3) : num.toFixed(2);
     }
     // Format totals for FP and total_min with 1 decimal
     if (viewMode === 'totals' && (key.includes('_fp') || key === 'total_min')) {
        return num.toFixed(1);
     }
    // Default: Format Per Game (Averages) with 1 decimal
    return num.toFixed(1);
};


// Define available seasons
const availableSeasons = [2024, 2023, 2022];

// Define GP Filter options
const gpFilterOptions = [ { label: "All", value: 0 }, { label: ">10 GP", value: 10 }, { label: ">20 GP", value: 20 }, { label: ">40 GP", value: 40 }, ];

// Define Stat View options
const statViewOptions = [ { label: "Per Game", value: "perGame", suffix: "(Avg)" }, { label: "Season Totals", value: "totals", suffix: "(Total)" }, { label: "Per Minute", value: "perMinute", suffix: "(Per Min)" }, ];

// Main Component
function PlayerStatsTable({ initialSeason = 2024 }) {
    const [allStats, setAllStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [season, setSeason] = useState(initialSeason);
    const [scoringSystem, setScoringSystem] = useState('UD');
    const [statViewMode, setStatViewMode] = useState(statViewOptions[0].value);
    const [sortConfig, setSortConfig] = useState({ key: scoringSystem === 'UD' ? 'ud_fp' : 'dk_fp', direction: 'descending' }); // Adjusted initial sort key
    const [searchQuery, setSearchQuery] = useState('');
    const [minGpFilter, setMinGpFilter] = useState(gpFilterOptions[0].value);

    // --- Sorting Logic ---
    const sortData = useCallback((data, config) => { /* ... (no changes) ... */ if (!config?.key) return data; const sorted = [...(data || [])].sort((a, b) => { const displayKey = config.key; let aValue = a[displayKey]; let bValue = b[displayKey]; if (displayKey === 'first_name') { aValue = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase(); bValue = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase(); } else { aValue = aValue ?? (config.direction === 'descending' ? -Infinity : Infinity); bValue = bValue ?? (config.direction === 'descending' ? -Infinity : Infinity); } if (aValue < bValue) { return config.direction === 'ascending' ? -1 : 1; } if (aValue > bValue) { return config.direction === 'ascending' ? 1 : -1; } return 0; }); return sorted; }, []);

    // --- Data Fetching ---
    // Use useCallback with scoringSystem dependency to set initial sort correctly
    const fetchData = useCallback(async (fetchSeason) => { if (isNaN(parseInt(fetchSeason, 10))) { console.error("Invalid season..."); setError("Invalid season..."); setAllStats([]); setLoading(false); return; } console.log(`Fetching data for season: ${fetchSeason}`); setLoading(true); setError(null); setSearchQuery(''); setMinGpFilter(gpFilterOptions[0].value); setStatViewMode(statViewOptions[0].value); try { const response = await fetch(`/api/nba/season-stats?season=${fetchSeason}`); if (!response.ok) { let errorData; try { errorData = await response.json(); } catch (parseError) { console.error("Failed to parse error response:", parseError); errorData = { message: `HTTP error! status: ${response.status}` }; } throw new Error(errorData.message || `HTTP error! status: ${response.status}`); } const data = await response.json(); console.log(`Data received for season ${fetchSeason}, processing...`); const initialSortKey = scoringSystem === 'UD' ? 'ud_fp' : 'dk_fp'; const initialConfig = { key: initialSortKey, direction: 'descending' }; setAllStats(data.data || []); setSortConfig(initialConfig); } catch (e) { console.error("Failed to fetch stats:", e); setError(e.message || "Failed to load data."); setAllStats([]); } finally { setLoading(false); console.log(`Finished fetching/processing for season: ${fetchSeason}`); } }, [scoringSystem]); // Depend on scoringSystem for initial sort

    // Initial fetch and re-fetch when season changes
    useEffect(() => { fetchData(season); }, [season, fetchData]);

    // --- Filtering & Derived Stats Logic ---
    const processedAndFilteredStats = useMemo(() => {
        let processed = allStats;
        if (searchQuery) { /* ... search filter ... */ const lowerCaseQuery = searchQuery.toLowerCase(); processed = processed.filter(player => { const fullName = `${player.first_name || ''} ${player.last_name || ''}`.toLowerCase(); return fullName.includes(lowerCaseQuery); }); }
        if (minGpFilter > 0) { /* ... gp filter ... */ processed = processed.filter(player => (player.gp || 0) >= minGpFilter); }

        processed = processed.map(player => {
            const gp = player.gp || 0;
            const total_min = player.total_min || 0;
            let displayData = { ...player };

            if (statViewMode === 'totals') {
                displayData.display_min = player.total_min;
                displayData.display_pts = player.total_pts;
                displayData.display_reb = player.total_reb;
                displayData.display_ast = player.total_ast;
                displayData.display_stl = player.total_stl;
                displayData.display_blk = player.total_blk;
                displayData.display_turnover = player.total_turnover;
                displayData.display_ud_fp = player.total_ud_fp;
                displayData.display_dk_fp = player.total_dk_fp;
            } else if (statViewMode === 'perMinute') {
                const factor = total_min > 0 ? 1 : 0;
                displayData.display_min = player.min; // Keep avg min
                displayData.display_pts = factor * (player.total_pts / total_min);
                displayData.display_reb = factor * (player.total_reb / total_min);
                displayData.display_ast = factor * (player.total_ast / total_min);
                displayData.display_stl = factor * (player.total_stl / total_min);
                displayData.display_blk = factor * (player.total_blk / total_min);
                displayData.display_turnover = factor * (player.total_turnover / total_min);
                displayData.display_ud_fp = factor * (player.total_ud_fp / total_min);
                displayData.display_dk_fp = factor * (player.total_dk_fp / total_min);
            } else { // Default 'perGame'
                displayData.display_min = player.min;
                displayData.display_pts = player.pts;
                displayData.display_reb = player.reb;
                displayData.display_ast = player.ast;
                displayData.display_stl = player.stl;
                displayData.display_blk = player.blk;
                displayData.display_turnover = player.turnover;
                displayData.display_ud_fp = player.ud_fp;
                displayData.display_dk_fp = player.dk_fp;
            }
            // Add first_name here so sortData can access it via displayKey
            displayData.first_name = player.first_name;
            displayData.team_abbreviation = player.team_abbreviation;
            displayData.position = player.position;

            return displayData;
        });

        return sortData(processed, sortConfig);
    }, [allStats, searchQuery, minGpFilter, statViewMode, sortConfig, sortData]);

    // --- Event Handlers ---
    const handleSeasonChange = (event) => { /* ... (no changes) ... */ const newSeason = parseInt(event.target.value, 10); if (!isNaN(newSeason)) { console.log("Season changed to:", newSeason); setSeason(newSeason); } };
    // Update scoring change to use correct initial sort key based on view mode
    const handleScoringChange = (system) => {
        setScoringSystem(system);
        // When changing scoring system, sort by the corresponding FP column for the current view mode
        const newSortKey = system === 'UD' ? 'display_ud_fp' : 'display_dk_fp';
        requestSort(newSortKey);
    };
    const requestSort = useCallback((key) => { /* ... (no changes) ... */ let direction = 'descending'; if (['first_name', 'team_abbreviation', 'position'].includes(key)) { direction = 'ascending'; } if (sortConfig.key === key && sortConfig.direction === 'descending') { direction = 'ascending'; } else if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; } setSortConfig({ key: key, direction }); }, [sortConfig]);
    const handleStatViewChange = (viewModeValue) => {
        setStatViewMode(viewModeValue);
        // Optional: Reset sort when changing view mode? Let's reset to FP for the current scoring system
         const newSortKey = scoringSystem === 'UD' ? 'display_ud_fp' : 'display_dk_fp';
         setSortConfig({ key: newSortKey, direction: 'descending' });
    };


    // --- Column Definitions ---
    const getSuffix = (mode) => statViewOptions.find(o => o.value === mode)?.suffix || '';
    const suffix = getSuffix(statViewMode);

    const columns = useMemo(() => [
        // Use displayKey for sorting, original key for data access if needed
        { key: 'first_name', displayKey: 'first_name', label: 'Player', sortable: true, sticky: true, title: "Player Name", className: "sticky left-0 bg-white dark:bg-gray-800 z-10 whitespace-nowrap px-4 py-2 font-medium text-gray-900 dark:text-white" },
        { key: 'team_abbreviation', displayKey: 'team_abbreviation', label: 'Team', sortable: true, title: "Team Abbreviation", className: "px-4 py-2 whitespace-nowrap" },
        { key: 'position', displayKey: 'position', label: 'Pos', sortable: true, title: "Standard Position (from API)", className: "px-4 py-2 whitespace-nowrap" },
        { key: scoringSystem === 'UD' ? 'ud_fp' : 'dk_fp', displayKey: scoringSystem === 'UD' ? 'display_ud_fp' : 'display_dk_fp', label: `${scoringSystem === 'UD' ? 'UD FP' : 'DK FP'}`, sortable: true, title: `${scoringSystem === 'UD' ? 'Underdog' : 'DraftKings'} Fantasy Points ${suffix}`, className: "px-4 py-2 whitespace-nowrap font-semibold" },
        { key: 'gp', displayKey: 'gp', label: 'GP', sortable: true, title: `Games Played ${getSuffix('totals')}`, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'min', displayKey: 'display_min', label: 'MIN', sortable: true, title: `Minutes ${suffix}`, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'pts', displayKey: 'display_pts', label: 'PTS', sortable: true, title: `Points ${suffix}`, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'reb', displayKey: 'display_reb', label: 'REB', sortable: true, title: `Rebounds ${suffix}`, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'ast', displayKey: 'display_ast', label: 'AST', sortable: true, title: `Assists ${suffix}`, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'stl', displayKey: 'display_stl', label: 'STL', sortable: true, title: `Steals ${suffix}`, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'blk', displayKey: 'display_blk', label: 'BLK', sortable: true, title: `Blocks ${suffix}`, className: "px-4 py-2 whitespace-nowrap" },
        { key: 'turnover', displayKey: 'display_turnover', label: 'TOV', sortable: true, title: `Turnovers ${suffix}`, className: "px-4 py-2 whitespace-nowrap" },
    ], [scoringSystem, statViewMode, suffix]); // Now depends on statViewMode for titles

    // --- Render ---
    return (
        <div className="p-4 md:p-6 bg-gray-100 dark:bg-gray-900 min-h-screen font-sans">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">NBA Player Season Averages ({season}-{season+1})</h1>

            {/* Controls Rows (No changes needed in JSX structure) */}
             <div className="mb-4 flex flex-wrap items-center gap-4"> <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"> <span className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-2">Scoring:</span> <button onClick={() => handleScoringChange('UD')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-150 ${scoringSystem === 'UD' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>Underdog</button> <button onClick={() => handleScoringChange('DK')} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-150 ${scoringSystem === 'DK' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>DraftKings</button> </div> <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"> <label htmlFor="season-select" className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-2">Season:</label> <select id="season-select" value={season} onChange={handleSeasonChange} className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm py-1 pl-3 pr-8"> {availableSeasons.map((year) => ( <option key={year} value={year}> {year}-{year + 1} </option> ))} </select> </div> <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"> <label htmlFor="player-search" className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-1">Search:</label> <input type="text" id="player-search" placeholder="Player name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm py-1 px-3" /> </div> </div>
             <div className="mb-6 flex flex-wrap items-center gap-4"> <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"> <span className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-2">Min Games:</span> {gpFilterOptions.map(option => ( <button key={option.value} onClick={() => setMinGpFilter(option.value)} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-150 ${minGpFilter === option.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}> {option.label} </button> ))} </div> <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"> <span className="text-sm font-medium text-gray-700 dark:text-gray-200 mr-2">Stat View:</span> {statViewOptions.map(option => ( <button key={option.value} onClick={() => handleStatViewChange(option.value)} className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-150 ${statViewMode === option.value ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}> {option.label} </button> ))} </div> </div>

            {/* Status Indicators & Table */}
             {loading && <div className="text-center py-10 text-gray-600 dark:text-gray-400">Loading player stats for {season}-{season+1}...</div>}
             {error && <div className="text-center py-10 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-4 rounded-lg">Error: {error}</div>}
             {!loading && !error && processedAndFilteredStats.length === 0 && allStats.length > 0 && ( <div className="text-center py-10 text-gray-600 dark:text-gray-400">No players found matching the current filters (Search: "{searchQuery}", Min GP: {minGpFilter}).</div> )}
             {!loading && !error && allStats.length === 0 && ( <div className="text-center py-10 text-gray-600 dark:text-gray-400">No player data found for the {season}-{season+1} season. (Have you run the update script for this season?)</div> )}

            {!loading && !error && processedAndFilteredStats.length > 0 && (
                 <div className="overflow-auto shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 relative max-h-[calc(100vh-300px)]">
                     <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 table-fixed md:table-auto">
                         <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-20">
                             <tr>
                                 {columns.map((col) => { /* ... (thead rendering - no changes) ... */ const sortKey = col.displayKey || col.key; const isSorted = sortConfig.key === sortKey; return ( <th key={col.key} scope="col" title={col.title || col.label} className={` px-4 py-3 ${col.sortable ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600' : ''} ${col.sticky ? 'sticky left-0 z-10 bg-gray-100 dark:bg-gray-700' : ''} ${isSorted ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' : ''} `} onClick={() => col.sortable && requestSort(sortKey)} style={col.key === 'first_name' ? { width: '180px' } : {}}> <div className="flex items-center"> {col.label} {col.sortable && (<span className={`ml-1 ${isSorted ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400'}`}>{isSorted ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}</span>)} </div> </th> ); })}
                             </tr>
                         </thead>
                         {/* Render table using processedAndFilteredStats */}
                         <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                             {processedAndFilteredStats.map((player) => (
                                 <tr key={player.player_id} className="hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors duration-100">
                                     {columns.map((col) => (
                                         <td key={`${player.player_id}-${col.key}`} className={col.className}>
                                             {/* === UPDATE: Conditional Rendering Logic === */}
                                             {(() => {
                                                 // Handle non-numeric columns first
                                                 if (col.key === 'first_name') {
                                                     return `${player.first_name} ${player.last_name}`;
                                                 }
                                                 if (col.key === 'team_abbreviation' || col.key === 'position') {
                                                     return player[col.displayKey] ?? 'N/A'; // Display string directly
                                                 }
                                                 // Otherwise, assume it's a numeric stat and format it
                                                 return formatStat(player[col.displayKey], col.key, statViewMode);
                                             })()}
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