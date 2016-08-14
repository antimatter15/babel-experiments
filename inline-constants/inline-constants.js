export default function ({types: t}) {
  return {
    visitor: {
      ReferencedIdentifier(path) {
        var binding = path.scope.getBinding(path.node.name);
        if(binding && binding.kind == 'const'){
			path.replaceWith(binding.path.node.init)
        }
      }
    }
  };
}
