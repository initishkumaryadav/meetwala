function nanoid(size = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: size }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

module.exports = { nanoid };