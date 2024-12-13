# web-3d-engine
Dummy project to learn 3d engine basics


# Design notes

## Uniforms handling
1. Global buffer 
- Renderer needs to know its content to write to it. (does not need to know buffers, bind groups, layouts)
- Whoever creates pipelines should know to include it
2. Global texture
- Whoever creates pipelines should know to include it
- Each material knows its own textures
- TextureManager - manages sizes and empty spaces
3. Per shader uniforms
- Whoever creates pipelines should know to include it
- Each material knows its own textures
- Someone has to bind them every frame