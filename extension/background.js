const extApi = globalThis.browser || globalThis.chrome;
extApi.runtime.onInstalled.addListener(() => {
  console.log("CP Failed Case Helper installed.");
});
