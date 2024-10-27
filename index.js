const express = require('express')
const pg = require('pg')
const format = require('pg-format')
require('dotenv').config()

const app = express()

// Verifico que las variables de entorno se cargaron correctamente
console.log({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
})

// Configuro la conexión con PostgreSQL usando una cadena de conexión
const pool = new pg.Pool({
  connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
})

// Creo Middleware para registrar rutas consultadas
app.use((req, res, next) => {
  console.log(`Ruta consultada: ${req.originalUrl}`)
  next()
})

// Esta es la función HATEOAS
const prepararHATEOAS = (joyas) => {
  return {
    total: joyas.length,
    results: joyas.map((joya) => ({
      nombre: joya.nombre,
      href: `/joyas/${joya.id}`,
    })),
  }
}

// Esta es la ruta GET /joyas con HATEOAS, límites, paginación y ordenamiento
app.get('/joyas', async (req, res) => {
  try {
    const { limits = 10, page = 1, order_by = 'id_ASC' } = req.query
    const [campo, direccion] = order_by.split('_')
    const offset = (page - 1) * limits
    const query = format(
      'SELECT * FROM inventario ORDER BY %s %s LIMIT %s OFFSET %s',
      campo,
      direccion,
      limits,
      offset
    )

    const { rows } = await pool.query(query)
    res.json(prepararHATEOAS(rows))
  } catch (error) {
    console.error('Error en la ruta GET /joyas:', error)
    res.status(500).json({ error: 'Error al obtener las joyas' })
  }
})

// Esta es la ruta GET /joyas/filtros con filtros parametrizados para evitar SQL Injection
app.get('/joyas/filtros', async (req, res) => {
  try {
    const { precio_max, precio_min, categoria, metal } = req.query
    const filtros = []
    const values = []

    if (precio_max) filtros.push(`precio <= $${values.push(precio_max)}`)
    if (precio_min) filtros.push(`precio >= $${values.push(precio_min)}`)
    if (categoria) filtros.push(`categoria = $${values.push(categoria)}`)
    if (metal) filtros.push(`metal = $${values.push(metal)}`)

    const query = `SELECT * FROM inventario ${
      filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''
    }`
    const { rows } = await pool.query(query, values)
    res.json(prepararHATEOAS(rows))
  } catch (error) {
    console.error('Error en la ruta GET /joyas/filtros:', error)
    res.status(500).json({ error: 'Error al filtrar las joyas' })
  }
})

// Inicio el servidor
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`)
})
