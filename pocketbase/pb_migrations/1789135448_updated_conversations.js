/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_728114816")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.role = \"admin\" || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id) || metadata.schoolWide = true",
    "viewRule": "@request.auth.role = \"admin\" || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id) || metadata.schoolWide = true"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_728114816")

  // update collection data
  unmarshal({
    "listRule": "@request.auth.role = \"admin\" || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id)",
    "viewRule": "@request.auth.role = \"admin\" || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id)"
  }, collection)

  return app.save(collection)
})
