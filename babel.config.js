module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ⚠️ react-native-reanimated DOIT être le dernier plugin
      'react-native-reanimated/plugin',
    ],
  };
};
