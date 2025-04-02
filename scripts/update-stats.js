// MODIFIED: Stores total stats in addition to averages

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { BalldontlieAPI, APIError } = require("@balldontlie/sdk");
const axios = require('axios');

// --- Initialize Clients (No changes) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) { console.error("Supabase URL or Service Role Key missing..."); process.exit(1); }
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const balldontlieApiKey = process.env.BALLDONTLIE_API_KEY;
if (!balldontlieApiKey) { console.error("BALLDONTLIE_API_KEY missing..."); process.exit(1); }
const balldontlieApi = new BalldontlieAPI({ apiKey: balldontlieApiKey });

// --- Helper Functions (No changes) ---
function calculateUnderdogPoints(stats) { /* ... */ return ( (stats.pts || 0) * 1.0 + (stats.reb || 0) * 1.2 + (stats.ast || 0) * 1.5 + (stats.stl || 0) * 3.0 + (stats.blk || 0) * 3.0 + (stats.turnover || 0) * -1.0 ); }
function calculateDraftKingsPoints(stats) { /* ... */ let points = (stats.pts || 0) * 1.0 + (stats.fg3m || 0) * 0.5 + (stats.reb || 0) * 1.25 + (stats.ast || 0) * 1.5 + (stats.stl || 0) * 2.0 + (stats.blk || 0) * 2.0 + (stats.turnover || 0) * -0.5; let doubleDigitCategories = 0; if ((stats.pts || 0) >= 10) doubleDigitCategories++; if ((stats.reb || 0) >= 10) doubleDigitCategories++; if ((stats.ast || 0) >= 10) doubleDigitCategories++; if ((stats.stl || 0) >= 10) doubleDigitCategories++; if ((stats.blk || 0) >= 10) doubleDigitCategories++; if (doubleDigitCategories >= 3) { points += 3.0; } else if (doubleDigitCategories >= 2) { points += 1.5; } return points; }
function parseMinutes(minString) { /* ... */ if (minString === null || minString === undefined || minString === "") { return 0; } if (typeof minString === 'string' && !minString.includes(':')) { const minutes = parseInt(minString, 10); return isNaN(minutes) ? 0 : minutes; } if (typeof minString !== 'string') { return typeof minString === 'number' ? minString : 0; } const parts = minString.split(':'); const minutes = parseInt(parts[0], 10); const seconds = parseInt(parts[1], 10); if (isNaN(minutes) || isNaN(seconds)) { return 0; } return minutes + seconds / 60; }

async function updateSeasonStats(seasonNum) {
    console.log(`Starting update for season ${seasonNum}...`);
    let allStats = [];
    let nextCursor = null;
    let pageCount = 0;
    const perPageNum = 100;
    console.log(`Fetching ALL stats from balldontlie for season ${seasonNum}...`);
    try {
        // ... (Fetch loop - no changes) ...
         do { pageCount++; if (pageCount > 1) await new Promise(resolve => setTimeout(resolve, 100)); console.log(`Fetching page ${pageCount} (cursor: ${nextCursor})...`); const params = { seasons: [seasonNum], per_page: perPageNum, postseason: false }; if (nextCursor !== null) { params.cursor = nextCursor; } const response = await balldontlieApi.nba.getStats(params); if (response.data && response.data.length > 0) { allStats = allStats.concat(response.data); nextCursor = response.meta?.next_cursor || null; } else { console.log(`No more data received on page ${pageCount}. Stopping pagination.`); nextCursor = null; } } while (nextCursor !== null);
         console.log(`FETCH COMPLETE: Fetched total ${allStats.length} stat lines across ${pageCount} pages.`);
    } catch (error) { /* ... error handling ... */ console.error("Error fetching from Balldontlie API:", error.message); if (error instanceof APIError) { console.error("API Error Details:", error.response); } return; }

    console.log("Processing stats...");
    const playerAggregates = {};
    // Aggregate totals (this part remains the same)
    allStats.forEach(stat => { /* ... aggregation logic ... */ if (!stat || !stat.player || !stat.player.id || stat.min === null || stat.min === undefined) { return; } const minutesPlayed = parseMinutes(stat.min); if (minutesPlayed <= 0) { return; } const playerId = stat.player.id; if (!playerAggregates[playerId]) { playerAggregates[playerId] = { playerInfo: { id: stat.player.id, first_name: stat.player.first_name, last_name: stat.player.last_name, position: stat.player.position || 'N/A', team: stat.team ? { id: stat.team.id, abbreviation: stat.team.abbreviation } : { id: 0, abbreviation: 'N/A' } }, games_played: 0, total_min: 0, total_pts: 0, total_reb: 0, total_ast: 0, total_stl: 0, total_blk: 0, total_turnover: 0, total_fg3m: 0, latest_game_date: '1900-01-01' }; } const agg = playerAggregates[playerId]; agg.games_played += 1; agg.total_min += minutesPlayed; agg.total_pts += stat.pts || 0; agg.total_reb += stat.reb || 0; agg.total_ast += stat.ast || 0; agg.total_stl += stat.stl || 0; agg.total_blk += stat.blk || 0; agg.total_turnover += stat.turnover || 0; agg.total_fg3m += stat.fg3m || 0; const gameDate = stat.game?.date; if (gameDate && gameDate > agg.latest_game_date) { agg.latest_game_date = gameDate; if (stat.team) { agg.playerInfo.team = { id: stat.team.id, abbreviation: stat.team.abbreviation }; } } else if (!agg.latest_game_date && stat.team) { agg.playerInfo.team = { id: stat.team.id, abbreviation: stat.team.abbreviation }; } });

    // Calculate Averages & Format for Database (Include Totals)
    const dataToUpsert = Object.values(playerAggregates).map(agg => {
        const gp = agg.games_played;
        if (gp === 0) return null;

        // Calculate averages (needed for FP calculations)
        const avgStats = {
            min: (agg.total_min / gp),
            pts: (agg.total_pts / gp),
            reb: (agg.total_reb / gp),
            ast: (agg.total_ast / gp),
            stl: (agg.total_stl / gp),
            blk: (agg.total_blk / gp),
            turnover: (agg.total_turnover / gp),
            fg3m: (agg.total_fg3m / gp)
        };
        const avg_ud_fp = calculateUnderdogPoints(avgStats);
        const avg_dk_fp = calculateDraftKingsPoints(avgStats);

        // *** NEW: Calculate Total Fantasy Points ***
        // We need to calculate totals based on *total* stats, handling DD/TD for DK totals is tricky without game logs.
        // Let's approximate total FP by multiplying average FP by GP for now.
        // A more accurate way would sum points per game log, but that's more complex.
        const total_ud_fp_approx = avg_ud_fp * gp;
        const total_dk_fp_approx = avg_dk_fp * gp; // This won't perfectly capture game-by-game DD/TD bonuses

        // Map to database column names, including new total columns
        return {
            // Existing Columns
            player_id: agg.playerInfo.id,
            season: seasonNum,
            first_name: agg.playerInfo.first_name,
            last_name: agg.playerInfo.last_name,
            team_abbreviation: agg.playerInfo.team.abbreviation,
            position: agg.playerInfo.position,
            gp: gp, // Total GP
            min: avgStats.min, // Avg Min
            pts: avgStats.pts, // Avg Pts
            reb: avgStats.reb, // Avg Reb
            ast: avgStats.ast, // Avg Ast
            stl: avgStats.stl, // Avg Stl
            blk: avgStats.blk, // Avg Blk
            turnover: avgStats.turnover, // Avg TOV
            ud_fp: avg_ud_fp, // Avg UD FP
            dk_fp: avg_dk_fp, // Avg DK FP

            // *** NEW: Total Columns ***
            total_min: agg.total_min,
            total_pts: agg.total_pts,
            total_reb: agg.total_reb,
            total_ast: agg.total_ast,
            total_stl: agg.total_stl,
            total_blk: agg.total_blk,
            total_turnover: agg.total_turnover,
            total_fg3m: agg.total_fg3m,
            total_ud_fp: total_ud_fp_approx, // Store approximated total UD FP
            total_dk_fp: total_dk_fp_approx, // Store approximated total DK FP
        };
    }).filter(p => p !== null);

    console.log(`PROCESSING COMPLETE: Processed stats for ${dataToUpsert.length} players.`);

    // Upsert Data into Supabase
    if (dataToUpsert.length > 0) {
        console.log(`Upserting ${dataToUpsert.length} records (with totals) into Supabase table 'player_season_stats'...`);
        try {
            // Batch upsert might be needed for very large datasets, but standard upsert is fine here.
            const chunkSize = 500; // Supabase upsert often works better in chunks
            for (let i = 0; i < dataToUpsert.length; i += chunkSize) {
                const chunk = dataToUpsert.slice(i, i + chunkSize);
                console.log(`Upserting chunk ${i / chunkSize + 1}...`);
                const { error } = await supabaseAdmin
                    .from('player_season_stats')
                    .upsert(chunk, {
                        onConflict: 'player_id, season'
                    });
                if (error) { throw error; } // Throw error to be caught below
            }
            console.log(`Supabase upsert successful!`);
        } catch (dbError) {
            console.error("Error during Supabase upsert operation:", dbError);
            return; // Stop script on DB error
        }
    } else {
        console.log("No data to upsert.");
    }

    console.log(`Update process finished for season ${seasonNum}.`);
}

// --- Run the Update ---
const targetSeason = process.argv[2] ? parseInt(process.argv[2], 10) : 2024;
if (isNaN(targetSeason)) { console.error("Invalid season..."); process.exit(1); }
updateSeasonStats(targetSeason).catch(e => console.error("Script failed:", e));