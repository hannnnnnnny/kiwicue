const toggle = document.querySelector("[data-language-toggle]");
const copyBlocks = document.querySelectorAll("[data-copy]");

let language = "en";

function setLanguage(nextLanguage) {
  language = nextLanguage === "zh" ? "zh" : "en";
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";

  copyBlocks.forEach((element) => {
    element.hidden = element.dataset.copy !== language;
  });

  toggle.setAttribute(
    "aria-label",
    language === "en" ? "切换到中文" : "Switch to English",
  );
}

toggle?.addEventListener("click", () => {
  setLanguage(language === "en" ? "zh" : "en");
});
