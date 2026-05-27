import express from 'express';
import { getPlugin } from '../plugins/registry';

export const datasourcesRouter = express.Router();

// Dynamic proxy matching system for universal execution
datasourcesRouter.post('/:pluginId/query', async (req, res) => {
  const { pluginId } = req.params;
  const { targets, range, config } = req.body;
  
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    return res.status(404).json({ error: `Plugin ${pluginId} not found or unregistered in backend registry.` });
  }

  try {
    const results = await Promise.all(
      targets.map((target: any) => plugin.executeQuery(target, range, config))
    );
    res.json(results);
  } catch (error: any) {
    console.error(`Error executing query backend for plugin ${pluginId}:`, error);
    res.status(500).json({ error: 'Internal server error during query execution', details: error.message });
  }
});

datasourcesRouter.post('/:pluginId/schema', async (req, res) => {
  const { pluginId } = req.params;
  const { config } = req.body;
  
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    return res.status(404).json({ error: `Plugin ${pluginId} not found.` });
  }

  try {
    const schema = await plugin.getDataSchema(config);
    res.json(schema);
  } catch (error: any) {
    console.error(`Error fetching schema for plugin ${pluginId}:`, error);
    res.status(500).json({ error: 'Internal server error fetching schema', details: error.message });
  }
});
