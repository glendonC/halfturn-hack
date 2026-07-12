module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Enables react-native-vision-camera v4 frame processors (worklets). It only
    // transforms functions carrying the 'worklet' directive, so it is a no-op for
    // the Expo Go bundle (which reaches none) and Phase-1 audio-only is unchanged.
    // NOTE: if react-native-reanimated is ever added, its plugin must come LAST.
    plugins: [['react-native-worklets-core/plugin']],
  };
};
