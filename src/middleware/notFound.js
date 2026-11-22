export function notFound(req, res) {
  res.status(404).json({
    status: 'error',
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

export default notFound;
