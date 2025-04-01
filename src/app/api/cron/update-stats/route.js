// API route triggered by Vercel Cron to update stats in Supabase.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Use createClient from the package
import { BalldontlieAPI, APIError } from "@balldontlie/sdk";
import axios from 'axios'; // SDK dependency

// IMPORTANT: dotenv is NOT needed here. Next.js automatically loads .env.local for API routes.

// --- Initialize Supabase Admin Client (using Service Role Key for write access) ---
// Note: We create a new client here using the service key specifically for this secured route.
// We could also import the regular client and use RLS policies if preferred, but service key is common for admin tasks.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("CRON JOB ERROR: Supabase URL or Service Role Key missing from environment variables.");
    // Return an error response immediately if keys are missing
    return NextResponse.json({ message: 'Server configuration error: Supabase keys missing.' }, { status: 500 });
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// --- Initialize Balldontlie Client ---
const balldontlieApiKey = process.env.BALLDONTLIE_API_KEY;
if (!balldontlieApiKey) {
    console.error("CRON JOB ERROR: BALLDONTLIE_API_KEY environment variable is not set.");
    return NextResponse.json({ message: 'Server configuration error: Balldontlie key missing.' }, { status: 500 });
}
const balldontlieApi = new BalldontlieAPI({ apiKey: balldontlieApiKey });

// --- Helper Functions (Copied from update-stats script) ---
function calculateUnderdogPoints(stats) { return ( (stats.pts || 0) * 1.0 + (stats.reb || 0) * 1.2 + (stats.ast || 0) * 1.5 + (stats.stl || 0) * 3.0 + (stats.blk || 0) * 3.0 + (stats.turnover || 0) * -1.0 ); }
function calculateDraftKingsPoints(stats) { let points = (stats.pts || 0) * 1.0 + (stats.fg3m || 0) * 0.5 + (stats.reb || 0) * 1.25 + (stats.ast || 0) * 1.5 + (stats.stl || 0) * 2.0 + (stats.blk || 0) * 2.0 + (stats.turnover || 0) * -0.5; let doubleDigitCategories = 0; if ((stats.pts || 0) >= 10) doubleDigitCategories++; if ((stats.reb || 0) >= 10) doubleDigitCategories++; if ((stats.ast || 0) >= 10) doubleDigitCategories++; if ((stats.stl || 0) >= 10) doubleDigitCategories++; if ((stats.blk || 0) >= 10) doubleDigitCategories++; if (doubleDigitCategories >= 3) { points += 3.0; } else if (doubleDigitCategories >= 2) { points += 1.5; } return points; }
function parseMinutes(minString) { if (minString === null || minString === undefined || minString === "") { return 0; } if (typeof minString === 'string' && !minString.includes(':')) { const minutes = parseInt(minString, 10); return isNaN(minutes) ? 0 : minutes; } if (typeof minString !== 'string') { return typeof minString === 'number' ? minString : 0; } const parts = minString.split(':'); const minutes = parseInt(parts[0], 10); const seconds = parseInt(parts[1], 10); if (isNaN(minutes) || isNaN(seconds)) { return 0; } return minutes + seconds / 60; }

// --- API Route Handler ---
export async function GET(request) {
    // 1. **Security Check:** Protect the endpoint
    // Vercel Cron passes a secret in the Authorization header (Bearer token)
    // Compare it to an environment variable only the server knows.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (!cronSecret) {
         console.error("CRON JOB ERROR: CRON_SECRET environment variable not set.");
         return NextResponse.json({ message: 'Server configuration error: Cron secret missing.' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn("CRON JOB WARNING: Unauthorized access attempt.");
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // If authorized, proceed with the update logic

    // Determine the season to update (e.g., current season or based on date)
    // For simplicity, let's hardcode the current season year for now.
    // You could make this dynamic later based on the current date.
    const currentNbaSeasonYear = 2024; // Adjust as needed for the actual current NBA season start year
    const seasonNum = currentNbaSeasonYear;

    console.log(`CRON JOB: Starting update for season ${seasonNum}...`);

    // 2. Fetch ALL data from Balldontlie
    let allStats = [];
    let nextCursor = null;
    let pageCount = 0;
    const perPageNum = 100;
    console.log(`CRON JOB: Fetching ALL stats from balldontlie for season ${seasonNum}...`);
    try {
        do {
            pageCount++;
            if (pageCount > 1) await new Promise(resolve => setTimeout(resolve, 100)); // Small delay

            console.log(`CRON JOB: Fetching page ${pageCount} (cursor: ${nextCursor})...`);
            const params = { seasons: [seasonNum], per_page: perPageNum, postseason: false };
            if (nextCursor !== null) { params.cursor = nextCursor; }

            const response = await balldontlieApi.nba.getStats(params);

            if (response.data && response.data.length > 0) {
                allStats = allStats.concat(response.data);
                nextCursor = response.meta?.next_cursor || null;
            } else {
                console.log(`CRON JOB: No more data received on page ${pageCount}. Stopping pagination.`);
                nextCursor = null;
            }
        } while (nextCursor !== null); // Loop until no more pages
        console.log(`CRON JOB FETCH COMPLETE: Fetched total ${allStats.length} stat lines across ${pageCount} pages.`);
    } catch (error) {
        console.error("CRON JOB ERROR: Error fetching from Balldontlie API:", error.message);
        if (error instanceof APIError) { console.error("API Error Details:", error.response); }
        return NextResponse.json({ message: `Failed to fetch data from source API: ${error.message}` }, { status: 502 }); // Bad Gateway
    }

    // 3. Process Stats
    console.log("CRON JOB: Processing stats...");
    const playerAggregates = {};
    allStats.forEach(stat => { /* ... aggregation logic ... */ if (!stat || !stat.player || !stat.player.id || stat.min === null || stat.min === undefined) { return; } const minutesPlayed = parseMinutes(stat.min); if (minutesPlayed <= 0) { return; } const playerId = stat.player.id; if (!playerAggregates[playerId]) { playerAggregates[playerId] = { playerInfo: { id: stat.player.id, first_name: stat.player.first_name, last_name: stat.player.last_name, position: stat.player.position || 'N/A', team: stat.team ? { id: stat.team.id, abbreviation: stat.team.abbreviation } : { id: 0, abbreviation: 'N/A' } }, games_played: 0, total_min: 0, total_pts: 0, total_reb: 0, total_ast: 0, total_stl: 0, total_blk: 0, total_turnover: 0, total_fg3m: 0, latest_game_date: '1900-01-01' }; } const agg = playerAggregates[playerId]; agg.games_played += 1; agg.total_min += minutesPlayed; agg.total_pts += stat.pts || 0; agg.total_reb += stat.reb || 0; agg.total_ast += stat.ast || 0; agg.total_stl += stat.stl || 0; agg.total_blk += stat.blk || 0; agg.total_turnover += stat.turnover || 0; agg.total_fg3m += stat.fg3m || 0; const gameDate = stat.game?.date; if (gameDate && gameDate > agg.latest_game_date) { agg.latest_game_date = gameDate; if (stat.team) { agg.playerInfo.team = { id: stat.team.id, abbreviation: stat.team.abbreviation }; } } else if (!agg.latest_game_date && stat.team) { agg.playerInfo.team = { id: stat.team.id, abbreviation: stat.team.abbreviation }; } });

    // 4. Calculate Averages & Format for Database
    const dataToUpsert = Object.values(playerAggregates).map(agg => { /* ... averaging logic ... */ const gp = agg.games_played; if (gp === 0) return null; const avgStats = { gp: gp, min: (agg.total_min / gp), pts: (agg.total_pts / gp), reb: (agg.total_reb / gp), ast: (agg.total_ast / gp), stl: (agg.total_stl / gp), blk: (agg.total_blk / gp), turnover: (agg.total_turnover / gp), fg3m: (agg.total_fg3m / gp) }; const underdogPoints = calculateUnderdogPoints(avgStats); const draftkingsPoints = calculateDraftKingsPoints(avgStats); return { player_id: agg.playerInfo.id, season: seasonNum, first_name: agg.playerInfo.first_name, last_name: agg.playerInfo.last_name, team_abbreviation: agg.playerInfo.team.abbreviation, position: agg.playerInfo.position, gp: avgStats.gp, min: avgStats.min, pts: avgStats.pts, reb: avgStats.reb, ast: avgStats.ast, stl: avgStats.stl, blk: avgStats.blk, turnover: avgStats.turnover, ud_fp: underdogPoints, dk_fp: draftkingsPoints }; }).filter(p => p !== null);

    console.log(`CRON JOB PROCESSING COMPLETE: Processed averages for ${dataToUpsert.length} players.`);

    // 5. Upsert Data into Supabase
    if (dataToUpsert.length > 0) {
        console.log(`CRON JOB: Upserting ${dataToUpsert.length} records into Supabase table 'player_season_stats'...`);
        try {
            const { error } = await supabaseAdmin
                .from('player_season_stats')
                .upsert(dataToUpsert, {
                    onConflict: 'player_id, season'
                });

            if (error) {
                // Throw error to be caught by outer catch block
                throw error;
            }
            console.log(`CRON JOB: Supabase upsert successful!`);
        } catch (dbError) {
            console.error("CRON JOB ERROR: Error during Supabase upsert operation:", dbError);
            return NextResponse.json({ message: `Database upsert failed: ${dbError.message}` }, { status: 500 });
        }
    } else {
        console.log("CRON JOB: No data processed to upsert.");
    }

    console.log(`CRON JOB: Update process finished successfully for season ${seasonNum}.`);
    return NextResponse.json({ success: true, message: `Successfully updated stats for season ${seasonNum}. Upserted ${dataToUpsert.length} records.` });

}

// Note: We typically use GET for Vercel Cron, but ensure idempotency or use POST if preferred.
// Vercel Cron supports GET requests.
