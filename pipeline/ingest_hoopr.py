#!/usr/bin/env python3
"""SportsPilot NBA historical ingestion (offline, reproducible).

Source: sportsdataverse / hoopR public data releases on GitHub, which republish
ESPN NBA schedules, team box scores, player box scores and play-by-play.
  https://github.com/sportsdataverse/sportsdataverse-data/releases
No API key, no paid service. ESPN remains the original publisher; treat the data as
research use only and re-check terms before any commercial redistribution.

Outputs (written to ../data/snapshot/):
  games.csv          one row per completed NBA game (regular season, play-in, playoffs)
  players.csv        one row per player-game appearance (2016+)
  live_states.csv    sampled in-game states from play-by-play with final outcome
  market_baseline.csv  ESPN-published sportsbook spread per game. COMPARISON ONLY.
                       Never joined into model features (enforced in JS tests).
  manifest.json      file hashes, row counts, source URLs, retrieval timestamp

Usage:
  python3 pipeline/ingest_hoopr.py --raw data/raw --out data/snapshot [--download]
"""
import argparse, hashlib, json, os, sys, urllib.request
from datetime import datetime, timezone

import pandas as pd

BASE = "https://github.com/sportsdataverse/sportsdataverse-data/releases/download"
TEAM_SEASONS = range(2008, 2028)     # 2008 == 2007-08 season ... 2027 == 2026-27 (in progress)
PLAYER_SEASONS = range(2016, 2028)
PBP_SEASONS = range(2019, 2028)
KEEP_SEASON_TYPES = {2, 3, 5}        # regular, playoffs, play-in. Excludes preseason/all-star.


def url_for(kind, season):
    return {
        "team": f"{BASE}/espn_nba_team_boxscores/team_box_{season}.parquet",
        "sched": f"{BASE}/espn_nba_schedules/nba_schedule_{season}.parquet",
        "player": f"{BASE}/espn_nba_player_boxscores/player_box_{season}.parquet",
        "pbp": f"{BASE}/espn_nba_pbp/play_by_play_{season}.parquet",
    }[kind]


LOCAL = {"team": "team_box_{}.parquet", "sched": "schedule_{}.parquet",
         "player": "player_box_{}.parquet", "pbp": "pbp_{}.parquet"}


def ensure(raw, kind, season, download):
    path = os.path.join(raw, LOCAL[kind].format(season))
    if not os.path.exists(path) and download:
        print(f"download {kind} {season}", file=sys.stderr)
        urllib.request.urlretrieve(url_for(kind, season), path)
    return path if os.path.exists(path) else None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build_games(raw, download):
    rows = []
    for season in TEAM_SEASONS:
        tp, sp = ensure(raw, "team", season, download), ensure(raw, "sched", season, download)
        if not tp:
            continue
        t = pd.read_parquet(tp)
        t = t[t.season_type.isin(KEEP_SEASON_TYPES)]
        neutral = {}
        if sp:
            s = pd.read_parquet(sp, columns=["game_id", "neutral_site", "status_type_completed"])
            neutral = dict(zip(s.game_id.astype("int64"), s.neutral_site.fillna(False).astype(bool)))
        home = t[t.team_home_away == "home"].copy()
        away = t[t.team_home_away == "away"].copy()
        cols = ["game_id", "team_id", "team_abbreviation", "team_score", "field_goals_attempted",
                "free_throws_attempted", "offensive_rebounds", "total_turnovers", "turnovers"]
        m = home[["season", "season_type", "game_date", "game_date_time"] + cols].merge(
            away[cols], on="game_id", suffixes=("_h", "_a"))
        for _, r in m.iterrows():
            hs, as_ = r.team_score_h, r.team_score_a
            if pd.isna(hs) or pd.isna(as_) or hs == as_:
                continue  # incomplete or invalid (NBA games cannot end tied)

            def poss(fga, fta, orb, tov):
                vals = [fga, fta, orb, tov]
                if any(pd.isna(v) for v in vals):
                    return ""
                return round(fga + 0.44 * fta - orb + tov, 1)
            tov_h = r.total_turnovers_h if not pd.isna(r.total_turnovers_h) else r.turnovers_h
            tov_a = r.total_turnovers_a if not pd.isna(r.total_turnovers_a) else r.turnovers_a
            rows.append({
                "game_id": int(r.game_id), "season": int(r.season), "season_type": int(r.season_type),
                "date": str(r.game_date),
                "tip_utc": pd.Timestamp(r.game_date_time).tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
                "home_id": int(r.team_id_h), "away_id": int(r.team_id_a),
                "home_abbr": r.team_abbreviation_h, "away_abbr": r.team_abbreviation_a,
                "home_score": int(hs), "away_score": int(as_),
                "neutral": int(bool(neutral.get(int(r.game_id), False))),
                "home_poss": poss(r.field_goals_attempted_h, r.free_throws_attempted_h, r.offensive_rebounds_h, tov_h),
                "away_poss": poss(r.field_goals_attempted_a, r.free_throws_attempted_a, r.offensive_rebounds_a, tov_a),
            })
    g = pd.DataFrame(rows).drop_duplicates("game_id").sort_values(["tip_utc", "game_id"])
    # ESPN labels All-Star / Rising Stars exhibitions as regular season. Keep only the 30
    # franchises (ESPN team ids 1-30) so exhibitions never touch ratings or validation.
    g = g[(g.home_id.between(1, 30)) & (g.away_id.between(1, 30))]
    return g


def build_players(raw, download, game_ids):
    frames = []
    keep = ["game_id", "season", "team_id", "athlete_id", "athlete_display_name", "minutes", "points",
            "rebounds", "offensive_rebounds", "assists", "three_point_field_goals_made",
            "three_point_field_goals_attempted", "field_goals_made", "field_goals_attempted", "free_throws_made", "free_throws_attempted",
            "steals", "blocks", "turnovers", "fouls", "starter", "did_not_play", "athlete_position_abbreviation"]
    for season in PLAYER_SEASONS:
        pp = ensure(raw, "player", season, download)
        if not pp:
            continue
        p = pd.read_parquet(pp)
        p = p[p.season_type.isin(KEEP_SEASON_TYPES)][keep]
        frames.append(p)
    p = pd.concat(frames)
    p = p[p.game_id.astype("int64").isin(game_ids) & p.athlete_id.notna()].copy()
    p["athlete_id"] = p.athlete_id.astype("int64")
    p["did_not_play"] = p.did_not_play.fillna(False).astype(int)
    p["starter"] = p.starter.fillna(False).astype(int)
    for c in keep[5:-3]:
        p[c] = p[c].fillna(0).astype(float).round(0).astype(int)
    p = p.rename(columns={"athlete_display_name": "name", "three_point_field_goals_made": "fg3m",
                          "three_point_field_goals_attempted": "fg3a", "field_goals_attempted": "fga", "field_goals_made": "fgm", "free_throws_made": "ftm",
                          "free_throws_attempted": "fta", "offensive_rebounds": "oreb",
                          "athlete_position_abbreviation": "pos"})
    p["name"] = p.name.str.replace(",", " ", regex=False)
    return p


def build_live(raw, download, finals):
    """Sample in-game states. Each row is a state observed after an event at that clock.
    Outcome label = did the home team win (from the final score in games.csv, not pbp)."""
    out, spreads = [], []
    for season in PBP_SEASONS:
        pp = ensure(raw, "pbp", season, download)
        if not pp:
            continue
        cols = ["game_id", "season", "season_type", "period_number", "start_game_seconds_remaining",
                "end_game_seconds_remaining", "home_score", "away_score", "team_id", "home_team_id",
                "type_text", "home_team_spread", "game_spread_available", "sequence_number",
                "end_quarter_seconds_remaining"]
        p = pd.read_parquet(pp, columns=cols)
        p = p[p.season_type.isin(KEEP_SEASON_TYPES)]
        p["sequence_number"] = pd.to_numeric(p.sequence_number, errors="coerce")
        p = p.sort_values(["game_id", "sequence_number"])
        for gid, g in p.groupby("game_id", sort=False):
            gid = int(gid)
            if gid not in finals:
                continue
            hw = finals[gid]
            first = g.iloc[0]
            if bool(first.game_spread_available) and not pd.isna(first.home_team_spread):
                spreads.append({"game_id": gid, "home_spread_line": float(first.home_team_spread)})
            reg = g[g.period_number <= 4]
            # Regulation: sample on a grid, coarse early, dense late.
            grid = list(range(2820, 300, -60)) + list(range(300, 60, -15)) + list(range(60, 0, -4))
            secs = reg.end_game_seconds_remaining.to_numpy()
            hs, as_ = reg.home_score.to_numpy(), reg.away_score.to_numpy()
            j = 0
            for t in grid:  # last event at or before game time t (seconds remaining >= t)
                while j + 1 < len(secs) and secs[j + 1] >= t:
                    j += 1
                if len(secs) == 0 or secs[j] < t:
                    continue
                out.append((gid, season, int(min(4, (2880 - t) // 720 + 1)), t, int(hs[j]), int(as_[j]), hw))
            # Overtime: sec_left is seconds remaining in THAT overtime period (period > 4).
            for per, og in g[g.period_number > 4].groupby("period_number"):
                q = og.end_quarter_seconds_remaining.to_numpy()
                hs2, as2 = og.home_score.to_numpy(), og.away_score.to_numpy()
                for t in (300, 240, 180, 120, 60, 30, 10):
                    idx = [k for k in range(len(q)) if not pd.isna(q[k]) and 0 <= q[k] <= 300 and q[k] >= t]
                    if idx:
                        k = idx[-1]
                        out.append((gid, season, int(per), t, int(hs2[k]), int(as2[k]), hw))
    live = pd.DataFrame(out, columns=["game_id", "season", "period", "sec_left", "home_score", "away_score", "home_win"])
    return live, pd.DataFrame(spreads).drop_duplicates("game_id")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--out", default="data/snapshot")
    ap.add_argument("--download", action="store_true")
    a = ap.parse_args()
    os.makedirs(a.raw, exist_ok=True)
    os.makedirs(a.out, exist_ok=True)
    games = build_games(a.raw, a.download)
    games.to_csv(os.path.join(a.out, "games.csv"), index=False)
    finals = {int(r.game_id): int(r.home_score > r.away_score) for r in games.itertuples()}
    players = build_players(a.raw, a.download, set(finals))
    players.to_csv(os.path.join(a.out, "players.csv"), index=False)
    live, spreads = build_live(a.raw, a.download, finals)
    live.to_csv(os.path.join(a.out, "live_states.csv"), index=False)
    spreads.to_csv(os.path.join(a.out, "market_baseline.csv"), index=False)
    manifest = {
        "source": "sportsdataverse-data GitHub releases (ESPN-derived)",
        "source_base_url": BASE,
        "built_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_game_date": str(games.date.max()),
        "files": {},
        "notes": [
            "market_baseline.csv is a sportsbook line published by ESPN; it is a comparison baseline only.",
            "Season label = year the season ends (2027 = 2026-27).",
        ],
    }
    for f in ["games.csv", "players.csv", "live_states.csv", "market_baseline.csv"]:
        path = os.path.join(a.out, f)
        manifest["files"][f] = {"sha256": sha256(path), "rows": sum(1 for _ in open(path)) - 1}
    with open(os.path.join(a.out, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
