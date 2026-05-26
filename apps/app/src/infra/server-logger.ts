const info = (message: string) => {
  // eslint-disable-next-line
  console.log(message);
};

const error = (message: string) => {
  // eslint-disable-next-line
  console.error(message);
};

export const logger = {
  info,
  error,
};
