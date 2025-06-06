const fetch = require('node-fetch');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Team configurations
const MLB_TEAMS = {
    // American League East
    'Boston Red Sox': { league: 'AL', division: 'East', abbrev: 'BOS' },
    'New York Yankees': { league: 'AL', division: 'East', abbrev: 'NYY' },
    'Tampa Bay Rays': { league: 'AL', division: 'East', abbrev: 'TB' },
    'Toronto Blue Jays': { league: 'AL', division: 'East', abbrev: 'TOR' },
    'Baltimore Orioles': { league: 'AL', division: 'East', abbrev: 'BAL' },
    
    // American League Central
    'Chicago White Sox': { league: 'AL', division: 'Central', abbrev: 'CWS' },
    'Cleveland Guardians': { league: 'AL', division: 'Central', abbrev: 'CLE' },
    'Detroit Tigers': { league: 'AL', division: 'Central', abbrev: 'DET' },
    'Kansas City Royals': { league: 'AL', division: 'Central', abbrev: 'KC' },
    'Minnesota Twins': { league: 'AL', division: 'Central', abbrev: 'MIN' },
    
    // American League West
    'Houston Astros': { league: 'AL', division: 'West', abbrev: 'HOU' },
    'Los Angeles Angels': { league: 'AL', division: 'West', abbrev: 'LAA' },
    'Oakland Athletics': { league: 'AL', division: 'West', abbrev: 'OAK' },
    'Seattle Mariners': { league: 'AL', division: 'West', abbrev: 'SEA' },
    'Texas Rangers': { league: 'AL', division: 'West', abbrev: 'TEX' },
    
    // National League East
    'Atlanta Braves': { league: 'NL', division: 'East', abbrev: 'ATL' },
    'Miami Marlins': { league: 'NL', division: 'East', abbrev: 'MIA' },
    'New York Mets': { league: 'NL', division: 'East', abbrev: 'NYM' },
    'Philadelphia Phillies': { league: 'NL', division: 'East', abbrev: 'PHI' },
    'Washington Nationals': { league: 'NL', division: 'East', abbrev: 'WSH' },
    
    // National League Central
    'Chicago Cubs': { league: 'NL', division: 'Central', abbrev: 'CHC' },
    'Cincinnati Reds': { league: 'NL', division: 'Central', abbrev: 'CIN' },
    'Milwaukee Brewers': { league: 'NL', division: 'Central', abbrev: 'MIL' },
    'Pittsburgh Pirates': { league: 'NL', division: 'Central', abbrev: 'PIT' },
    'St. Louis Cardinals': { league: 'NL', division: 'Central', abbrev: 'STL' },
    
    // National League West
    'Arizona Diamondbacks': { league: 'NL', division: 'West', abbrev: 'ARI' },
    'Colorado Rockies': { league: 'NL', division: 'West', abbrev: 'COL' },
    'Los Angeles Dodgers': { league: 'NL', division: 'West', abbrev: 'LAD' },
    'San Diego Padres': { league: 'NL', division: 'West', abbrev: 'SD' },
    'San Francisco Giants': { league: 'NL', division: 'West', abbrev: 'SF' }
};

// Get yesterday's date in YYYYMMDD format
function getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// Fetch MLB scores from ESPN
async function fetchMLBScores() {
    try {
        const yesterday = getYesterdayDate();
        const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${yesterday}`;
        
        console.log(`Fetching scores for ${yesterday}...`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        const games = data.events || [];
        
        if (games.length === 0) {
            console.log('No games found for yesterday');
            return [];
        }

        const processedGames = games.map(game => {
            const competition = game.competitions[0];
            const homeTeam = competition.competitors.find(team => team.homeAway === 'home');
            const awayTeam = competition.competitors.find(team => team.homeAway === 'away');
            
            return {
                homeTeam: homeTeam.team.displayName,
                awayTeam: awayTeam.team.displayName,
                homeScore: parseInt(homeTeam.score) || 0,
                awayScore: parseInt(awayTeam.score) || 0,
                status: competition.status.type.description,
                isComplete: competition.status.type.completed
            };
        });

        console.log(`Found ${processedGames.length} games`);
        return processedGames;
        
    } catch (error) {
        console.error('Error fetching scores:', error);
        return [];
    }
}

// Generate email HTML content
function generateEmailHTML(games) {
    if (games.length === 0) {
        return `
        <html>
        <body style="font-family: 'Courier New', monospace; padding: 20px;">
            <h2 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">
                MLB SCOREBOX - ${new Date().toLocaleDateString()}
            </h2>
            <p style="text-align: center; font-style: italic;">No games were played yesterday.</p>
        </body>
        </html>
        `;
    }

    // Group games by league and division
    const gamesByLeague = {
        'AL': { 'East': [], 'Central': [], 'West': [] },
        'NL': { 'East': [], 'Central': [], 'West': [] }
    };
    
    games.forEach(game => {
        const homeTeamInfo = MLB_TEAMS[game.homeTeam];
        if (homeTeamInfo) {
            const league = homeTeamInfo.league;
            const division = homeTeamInfo.division;
            gamesByLeague[league][division].push(game);
        }
    });

    let html = `
    <html>
    <head>
        <style>
            body { font-family: 'Courier New', monospace; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .league { margin-bottom: 30px; border: 1px solid #000; padding: 15px; }
            .league-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 15px; }
            .division { margin-bottom: 20px; }
            .division-title { font-weight: bold; font-size: 14px; border-bottom: 1px solid #666; padding-bottom: 3px; margin-bottom: 10px; }
            .game { margin-bottom: 10px; padding: 8px; border-bottom: 1px dotted #ccc; }
            .team-line { display: flex; justify-content: space-between; margin: 2px 0; }
            .winner { font-weight: bold; }
            .score { font-weight: bold; min-width: 30px; text-align: right; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>MLB SCOREBOX - ${new Date().toLocaleDateString()}</h2>
        </div>
    `;

    // Add American League
    html += `<div class="league"><div class="league-title">AMERICAN LEAGUE</div>`;
    ['East', 'Central', 'West'].forEach(division => {
        if (gamesByLeague['AL'][division].length > 0) {
            html += `<div class="division"><div class="division-title">AL ${division}</div>`;
            gamesByLeague['AL'][division].forEach(game => {
                const awayWon = game.awayScore > game.homeScore && game.isComplete;
                const homeWon = game.homeScore > game.awayScore && game.isComplete;
                
                html += `
                <div class="game">
                    <div class="
