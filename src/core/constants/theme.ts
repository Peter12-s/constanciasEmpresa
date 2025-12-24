import { createTheme, type MantineColorsTuple } from "@mantine/core";

export const PRIMARY_COLOR = ["#e5faff", "#d1f0fe", "#a2dffa", "#71cdf7", "#4dbff5", "#39b5f4", "#2cb1f5", "#1e9bda", "#058ac4", "#0077ae"] as MantineColorsTuple;

export const SECONDARY_COLOR = ["#fff9e1", "#fff1cd", "#fde29d", "#fbd168", "#fac33c", "#f9bb21", "#f9b60f", "#dea000", "#c58e00", "#ab7900"] as MantineColorsTuple;

export const TERTIARY_COLOR = ["#ffe8ee", "#ffcfd9", "#ff9caf", "#fe6584", "#fd395f", "#fd1f47", "#fe0f3b", "#e3002d", "#cb0027", "#b20020"] as MantineColorsTuple;

export const FOURTH_COLOR = ["#e6f9ff", "#d1eefd", "#a3daf9", "#72c6f5", "#4db5f2", "#39aaf1", "#2ba5f1", "#1d90d7", "#0880c1", "#006fab"] as MantineColorsTuple;

export const FIFTH_COLOR = ["#fcedf6", "#f4d8e9", "#ebadd2", "#e37fba", "#dc5aa6", "#d74399", "#d63794", "#be2b80", "#aa2472", "#951863"] as MantineColorsTuple;

export const DISABLED_ACTION_COLOR = "var(--mantine-color-gray-5)";

export const theme = createTheme({
    colors: {
        "app-primary": PRIMARY_COLOR,
        "app-secondary": SECONDARY_COLOR,
        "app-tertiary": TERTIARY_COLOR,
        "app-fourth": FOURTH_COLOR,
        "app-fifth": FIFTH_COLOR,
        secondary: SECONDARY_COLOR,
    },
    primaryColor: "app-primary",
    components: {
        Modal: {
            defaultProps: {
                overlayProps: { backgroundOpacity: 0.3 },
            },
        },
    },
});
