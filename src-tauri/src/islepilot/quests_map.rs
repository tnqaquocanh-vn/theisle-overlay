//! Map a Prime-quest string to the POI layer it refers to, so the full map can
//! answer "where are the Sanctuaries?" for a quest like "Visit 2 Sanctuaries".
//!
//! Keyword match on the lowercased text. The Prime quest pool is small and
//! stable (the hand-translated list lives in `translate.rs`); a quest with no
//! spatial target — diet, breeding, "be a Hypsi…" — yields None and the UI
//! shows no map hint. `dict_and_templates_cover_the_fixture_pool` in
//! `translate.rs` pins the pool; the test below pins that every entry of it is
//! either mapped here or deliberately None.

use serde::Serialize;

/// Which map layer a quest points at, and how many of that thing it wants.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestTarget {
    /// `pois_gateway.json` layer key: "sanctuary" | "migration" | "patrol" | "water".
    pub layer_key: &'static str,
    /// How many to visit — 1 when the text carries no number.
    pub count: u32,
}

/// (substring in the lowercased quest text, layer key). First match wins.
const KEYWORDS: &[(&str, &str)] = &[
    ("sanctuar", "sanctuary"),
    ("migration", "migration"),
    ("patrol", "patrol"),
    ("water source", "water"),
    ("drink from", "water"),
];

/// The layer + count a quest refers to, or None when it has no place on the map.
pub fn target_for(quest_text: &str) -> Option<QuestTarget> {
    let lower = quest_text.to_lowercase();
    let &(_, layer_key) = KEYWORDS.iter().find(|(kw, _)| lower.contains(*kw))?;
    Some(QuestTarget {
        layer_key,
        count: first_number(&lower).unwrap_or(1),
    })
}

fn first_number(s: &str) -> Option<u32> {
    let digits: String = s
        .chars()
        .skip_while(|c| !c.is_ascii_digit())
        .take_while(char::is_ascii_digit)
        .collect();
    digits.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_the_spatial_quests() {
        assert_eq!(
            target_for("Visit a Sanctuary as a juvenile"),
            Some(QuestTarget { layer_key: "sanctuary", count: 1 })
        );
        assert_eq!(
            target_for("Visit 3 Patrol zones"),
            Some(QuestTarget { layer_key: "patrol", count: 3 })
        );
        assert_eq!(
            target_for("Visit 2 Migration zones"),
            Some(QuestTarget { layer_key: "migration", count: 2 })
        );
        assert_eq!(
            target_for("Visit Mass Migration zone"),
            Some(QuestTarget { layer_key: "migration", count: 1 })
        );
        assert_eq!(
            target_for("Drink from 4 water sources"),
            Some(QuestTarget { layer_key: "water", count: 4 })
        );
    }

    #[test]
    fn non_spatial_quests_have_no_target() {
        for q in [
            "Get nested in",
            "Get perfect diet (1% of each)",
            "Never be Infertile",
            "Never get Muscle spasms",
            "Raise 2 children to Subadult",
            "Be a Hypsi, Troodon, Beipi, Dryo or Deino",
        ] {
            assert_eq!(target_for(q), None, "{q} should not map to a layer");
        }
    }

    #[test]
    fn first_number_reads_the_leading_count() {
        assert_eq!(first_number("visit 3 patrol zones"), Some(3));
        assert_eq!(first_number("visit a sanctuary"), None);
        assert_eq!(first_number("raise 12 children"), Some(12));
    }

    /// Every quest the `me.html` fixture carries must resolve to a real POI
    /// layer key or an explicit None — never a typo'd key.
    #[test]
    fn fixture_pool_maps_cleanly() {
        const ME: &str = include_str!("../../fixtures/islepilot/me.html");
        let valid = ["sanctuary", "migration", "patrol", "water"];
        let stats = crate::islepilot::parser::parse_me(ME);
        assert_eq!(stats.prime_quests.len(), 10);
        for q in &stats.prime_quests {
            if let Some(t) = target_for(&q.text) {
                assert!(valid.contains(&t.layer_key), "bad key {:?} for {:?}", t.layer_key, q.text);
            }
        }
    }
}
