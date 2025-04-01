// Standalone script to fetch data from balldontlie, process it,
    // and upsert it into the Supabase database.

    // Load environment variables from .env.local
    require('dotenv').config({ path: '.env.local' });

    const { createClient } = require('@supabase/supabase-js');
    const { BalldontlieAPI, APIError } = require("@balldontlie/sdk");
    const axios = require('axios'); // SDK dependency

    // --- Initialize Supabase Client (using Service Role Key for write access) ---
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use the secret Service Role Key

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Supabase URL or Service Role Key missing from environment variables.");
        process.exit(1); // Exit script if keys are missing
    }
    // Create a Supabase client with service_role privileges for admin tasks like upserting
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // --- Initialize Balldontlie Client ---
    const balldontlieApiKey = process.env.BALLDONTLIE_API_KEY;
    if (!balldontlieApiKey) {
        console.error("BALLDONTLIE_API_KEY environment variable is not set.");
        process.exit(1);
    }
    const balldontlieApi = new BalldontlieAPI({ apiKey: balldontlieApiKey });

    // --- Helper Functions (Copied from previous API route) ---
    function calculateUnderdogPoints(stats) { return ( (stats.pts || 0) * 1.0 + (stats.reb || 0) * 1.2 + (stats.ast || 0) * 1.5 + (stats.stl || 0) * 3.0 + (stats.blk || 0) * 3.0 + (stats.turnover || 0) * -1.0 ); }
    function calculateDraftKingsPoints(stats) { let points = (stats.pts || 0) * 1.0 + (stats.fg3m || 0) * 0.5 + (stats.reb || 0) * 1.25 + (stats.ast || 0) * 1.5 + (stats.stl || 0) * 2.0 + (stats.blk || 0) * 2.0 + (stats.turnover || 0) * -0.5; let doubleDigitCategories = 0; if ((stats.pts || 0) >= 10) doubleDigitCategories++; if ((stats.reb || 0) >= 10) doubleDigitCategories++; if ((stats.ast || 0) >= 10) doubleDigitCategories++; if ((stats.stl || 0) >= 10) doubleDigitCategories++; if ((stats.blk || 0) >= 10) doubleDigitCategories++; if (doubleDigitCategories >= 3) { points += 3.0; } else if (doubleDigitCategories >= 2) { points += 1.5; } return points; }
    function parseMinutes(minString) { if (minString === null || minString === undefined || minString === "") { return 0; } if (typeof minString === 'string' && !minString.includes(':')) { const minutes = parseInt(minString, 10); return isNaN(minutes) ? 0 : minutes; } if (typeof minString !== 'string') { return typeof minString === 'number' ? minString : 0; } const parts = minString.split(':'); const minutes = parseInt(parts[0], 10); const seconds = parseInt(parts[1], 10); if (isNaN(minutes) || isNaN(seconds)) { return 0; } return minutes + seconds / 60; }

    // --- Main Function to Fetch, Process, and Upsert Data ---
    async function updateSeasonStats(seasonNum) {
        console.log(`Starting update for season ${seasonNum}...`);

        // 1. Fetch ALL data from Balldontlie
        let allStats = [];
        let nextCursor = null;
        let pageCount = 0;
        const perPageNum = 100; // Fetch 100 per page
        console.log(`Fetching ALL stats from balldontlie for season ${seasonNum}...`);
        try {
            do {
                pageCount++;
                // Add slight delay to avoid hitting rate limits aggressively
                if (pageCount > 1) await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between pages after the first one

                console.log(`Fetching page ${pageCount} (cursor: ${nextCursor})...`);
                const params = { seasons: [seasonNum], per_page: perPageNum, postseason: false };
                if (nextCursor !== null) { params.cursor = nextCursor; }

                const response = await balldontlieApi.nba.getStats(params);

                if (response.data && response.data.length > 0) {
                    allStats = allStats.concat(response.data);
                    nextCursor = response.meta?.next_cursor || null;
                } else {
                    console.log(`No more data received on page ${pageCount}. Stopping pagination.`);
                    nextCursor = null;
                }
            } while (nextCursor !== null);
            console.log(`FETCH COMPLETE: Fetched total ${allStats.length} stat lines across ${pageCount} pages.`);
        } catch (error) {
            console.error("Error fetching from Balldontlie API:", error.message);
            if (error instanceof APIError) { console.error("API Error Details:", error.response); }
            return; // Stop script if fetching fails
        }

        // 2. Process Stats
        console.log("Processing stats...");
        const playerAggregates = {};
        allStats.forEach(stat => { /* ... aggregation logic ... */ if (!stat || !stat.player || !stat.player.id || stat.min === null || stat.min === undefined) { return; } const minutesPlayed = parseMinutes(stat.min); if (minutesPlayed <= 0) { return; } const playerId = stat.player.id; if (!playerAggregates[playerId]) { playerAggregates[playerId] = { playerInfo: { id: stat.player.id, first_name: stat.player.first_name, last_name: stat.player.last_name, position: stat.player.position || 'N/A', team: stat.team ? { id: stat.team.id, abbreviation: stat.team.abbreviation } : { id: 0, abbreviation: 'N/A' } }, games_played: 0, total_min: 0, total_pts: 0, total_reb: 0, total_ast: 0, total_stl: 0, total_blk: 0, total_turnover: 0, total_fg3m: 0, latest_game_date: '1900-01-01' }; } const agg = playerAggregates[playerId]; agg.games_played += 1; agg.total_min += minutesPlayed; agg.total_pts += stat.pts || 0; agg.total_reb += stat.reb || 0; agg.total_ast += stat.ast || 0; agg.total_stl += stat.stl || 0; agg.total_blk += stat.blk || 0; agg.total_turnover += stat.turnover || 0; agg.total_fg3m += stat.fg3m || 0; const gameDate = stat.game?.date; if (gameDate && gameDate > agg.latest_game_date) { agg.latest_game_date = gameDate; if (stat.team) { agg.playerInfo.team = { id: stat.team.id, abbreviation: stat.team.abbreviation }; } } else if (!agg.latest_game_date && stat.team) { agg.playerInfo.team = { id: stat.team.id, abbreviation: stat.team.abbreviation }; } });

        // 3. Calculate Averages & Format for Database
        const dataToUpsert = Object.values(playerAggregates).map(agg => {
            const gp = agg.games_played; if (gp === 0) return null;
            const avgStats = { gp: gp, min: (agg.total_min / gp), pts: (agg.total_pts / gp), reb: (agg.total_reb / gp), ast: (agg.total_ast / gp), stl: (agg.total_stl / gp), blk: (agg.total_blk / gp), turnover: (agg.total_turnover / gp), fg3m: (agg.total_fg3m / gp) };
            const underdogPoints = calculateUnderdogPoints(avgStats);
            const draftkingsPoints = calculateDraftKingsPoints(avgStats);

            // Map to database column names
            return {
                player_id: agg.playerInfo.id,
                season: seasonNum, // Add the season number
                first_name: agg.playerInfo.first_name,
                last_name: agg.playerInfo.last_name,
                team_abbreviation: agg.playerInfo.team.abbreviation,
                position: agg.playerInfo.position,
                gp: avgStats.gp,
                min: avgStats.min,
                pts: avgStats.pts,
                reb: avgStats.reb,
                ast: avgStats.ast,
                stl: avgStats.stl,
                blk: avgStats.blk,
                turnover: avgStats.turnover,
                ud_fp: underdogPoints,
                dk_fp: draftkingsPoints,
                // updated_at will be set automatically by Supabase if default is now()
            };
        }).filter(p => p !== null); // Remove any null entries

        console.log(`PROCESSING COMPLETE: Processed averages for ${dataToUpsert.length} players.`);

        // 4. Upsert Data into Supabase
        if (dataToUpsert.length > 0) {
            console.log(`Upserting ${dataToUpsert.length} records into Supabase table 'player_season_stats'...`);
            try {
                // Upsert based on the combination of player_id and season
                // If a row with the same player_id and season exists, it will be updated.
                // Otherwise, a new row will be inserted.
                const { data, error } = await supabaseAdmin
                    .from('player_season_stats')
                    .upsert(dataToUpsert, {
                        onConflict: 'player_id, season' // Specify columns that define a unique record
                        // ignoreDuplicates: false // Default is false, meaning it performs update on conflict
                    });

                if (error) {
                    console.error("Supabase upsert error:", error);
                } else {
                    console.log(`Supabase upsert successful!`);
                    // Supabase upsert doesn't typically return the updated rows by default in v2 unless specified
                    // console.log("Upsert result data:", data);
                }
            } catch (dbError) {
                console.error("Error during Supabase upsert operation:", dbError);
            }
        } else {
            console.log("No data to upsert.");
        }

        console.log(`Update process finished for season ${seasonNum}.`);
    }

    // --- Run the Update ---
    // Get season from command line arguments or default to 2024
    const targetSeason = process.argv[2] ? parseInt(process.argv[2], 10) : 2024;

    if (isNaN(targetSeason)) {
        console.error("Invalid season provided. Please provide a year as a command line argument.");
        process.exit(1);
    }

    updateSeasonStats(targetSeason).catch(e => console.error("Script failed:", e));
    