//! Wall clock in milliseconds, for search time limits.

#[cfg(target_arch = "wasm32")]
pub fn now_ms() -> f64 {
    #[cfg(feature = "wasm")]
    {
        js_sys::Date::now()
    }
    #[cfg(not(feature = "wasm"))]
    {
        0.0
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub fn now_ms() -> f64 {
    use std::sync::OnceLock;
    use std::time::Instant;
    static START: OnceLock<Instant> = OnceLock::new();
    START.get_or_init(Instant::now).elapsed().as_secs_f64() * 1000.0
}
