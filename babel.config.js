module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // worklets-core: VisionCamera v4 frame processors (no-op without 'worklet').
    // reanimated plugin must be last when present.
    plugins: [
      ['react-native-worklets-core/plugin'],
      'react-native-reanimated/plugin',
    ],
  };
};
