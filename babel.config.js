module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated 4.x n'a plus besoin du plugin Babel
  };
};
